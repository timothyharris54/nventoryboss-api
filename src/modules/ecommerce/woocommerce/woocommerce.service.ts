import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  EcommerceProvider,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { InventoryService } from 'src/modules/inventory/inventory.service';

type WoocommerceConnection = {
  id: string;
  provider: 'woocommerce';
  label: string;
  storeUrl: string | null;
  configured: boolean;
  channelKey?: string;
};

type WoocommerceRuntimeConfig = {
  connectionId: string;
  storeUrl: string | null;
  consumerKey: string | null;
  consumerSecret: string | null;
};

type WoocommerceProduct = {
  id: number;
  sku?: string | null;
  name?: string | null;
  status?: string | null;
  images?: Array<{ src?: string | null }> | null;
  image?: { src?: string | null } | null;
};

type WoocommerceOrder = {
  id: number;
  status?: string | null;
  date_created_gmt?: string | null;
  date_created?: string | null;
  currency?: string | null;
  total?: string | null;
  billing?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  line_items?: WoocommerceOrderLine[];
};

type WoocommerceOrderLine = {
  id: number;
  name?: string | null;
  product_id?: number | null;
  variation_id?: number | null;
  quantity?: number | string | null;
  sku?: string | null;
  price?: number | string | null;
  total?: string | null;
};

type SyncedProductSummary = {
  woocommerceId: number;
  productId: string;
  sku: string;
  name: string;
  action: 'created' | 'updated';
};

type SyncedOrderSummary = {
  woocommerceId: number;
  orderId: string;
  status: string;
  lineCount: number;
  unmappedLineCount: number;
  action: 'created' | 'updated';
};

type PostedOrderInventorySummary = {
  orderId: string;
  channelOrderId: string;
  orderLineId: string;
  channelLineId: string;
  productId: string;
  action: 'created' | 'existing';
};

type WoocommerceRequestOptions = {
  perPage?: number;
  page?: number;
};

const WOOCOMMERCE_CONNECTION_ID = 'woocommerce-demo';
const WOOCOMMERCE_PRODUCTS_PATH = '/wp-json/wc/v3/products';
const WOOCOMMERCE_ORDERS_PATH = '/wp-json/wc/v3/orders';
const DEFAULT_SYNC_PAGE_SIZE = 100;
const MAX_SYNC_PAGES = 25;
const INVENTORY_IMPACT_ORDER_STATUSES = ['processing', 'paid', 'completed'];

@Injectable()
export class WoocommerceService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async getConnections(accountId?: bigint): Promise<WoocommerceConnection[]> {
    if (accountId) {
      const connections = await this.prismaService.ecommerceConnection.findMany({
        where: {
          accountId,
          provider: EcommerceProvider.woocommerce,
          isActive: true,
        },
        orderBy: {
          id: 'asc',
        },
      });

      return connections.map((connection) => {
        const credentials = this.getCredentials(connection.credentials);

        return {
          id: connection.id.toString(),
          provider: 'woocommerce',
          label: connection.displayName,
          storeUrl: connection.storeUrl,
          configured: Boolean(
            connection.storeUrl &&
              credentials.consumerKey &&
              credentials.consumerSecret,
          ),
          channelKey: connection.channelKey,
        };
      });
    }

    const config = this.getConfig({ requireCredentials: false });

    return [
      {
        id: WOOCOMMERCE_CONNECTION_ID,
        provider: 'woocommerce',
        label: 'WooCommerce demo store',
        storeUrl: config.storeUrl,
        configured: Boolean(
          config.storeUrl && config.consumerKey && config.consumerSecret,
        ),
      },
    ];
  }

  private extractImageUrl(product: WoocommerceProduct): string | null {
    const directImage = product.image?.src?.trim();
    if (directImage) {
      return directImage;
    }

    const firstImage = product.images?.find((image) => image.src?.trim())?.src?.trim();
    return firstImage ?? null;
  }

  async testConnection(accountId?: bigint, connectionId?: bigint) {
    const config = accountId
      ? await this.getConfigForAccount(accountId, connectionId)
      : this.getConfig({ requireCredentials: true });
    const products = await this.fetchProducts({ perPage: 1 }, config);

    return {
      connectionId: config.connectionId,
      ok: true,
      productsEndpoint: this.getProductsEndpointForDisplay(config),
      sampleCount: products.length,
    };
  }

  async syncProducts(accountId: bigint, connectionId?: bigint) {
    const config = await this.getConfigForAccount(accountId, connectionId);
    const products = await this.fetchAllProducts(config);
    const synced: SyncedProductSummary[] = [];
    const skipped: Array<{ woocommerceId: number; reason: string }> = [];

    for (const product of products) {
      const sku = product.sku?.trim();
      const name = product.name?.trim();

      if (!sku) {
        skipped.push({
          woocommerceId: product.id,
          reason: 'missing_sku',
        });
        continue;
      }

      const existing = await this.prismaService.product.findUnique({
        where: {
          accountId_sku: {
            accountId,
            sku,
          },
        },
      });

      const imageUrl = this.extractImageUrl(product);

      const localProduct = await this.prismaService.product.upsert({
        where: {
          accountId_sku: {
            accountId,
            sku,
          },
        },
        create: {
          accountId,
          sku,
          name: name || sku,
          status: this.mapProductStatus(product.status),
          ...(imageUrl ? { imageUrl } : {}),
        },
        update: {
          name: name || sku,
          status: this.mapProductStatus(product.status),
          ...(imageUrl ? { imageUrl } : {}),
        },
      });

      synced.push({
        woocommerceId: product.id,
        productId: localProduct.id.toString(),
        sku,
        name: localProduct.name,
        action: existing ? 'updated' : 'created',
      });
    }

    return {
      connectionId: config.connectionId,
      fetched: products.length,
      synced: synced.length,
      skipped: skipped.length,
      items: synced,
      skippedItems: skipped,
    };
  }

  async syncOrders(accountId: bigint, connectionId?: bigint) {
    const config = await this.getConfigForAccount(accountId, connectionId);
    const orders = await this.fetchAllOrders(config);
    const synced: SyncedOrderSummary[] = [];
    const skipped: Array<{ woocommerceId: number; reason: string }> = [];

    for (const order of orders) {
      const orderedAt = this.getOrderDate(order);
      if (!orderedAt) {
        skipped.push({
          woocommerceId: order.id,
          reason: 'missing_order_date',
        });
        continue;
      }

      const existing = await this.prismaService.order.findUnique({
        where: {
          accountId_channel_channelOrderId: {
            accountId,
            channel: 'woocommerce',
            channelOrderId: order.id.toString(),
          },
        },
      });

      const lines = order.line_items ?? [];
      const skuSet = [
        ...new Set(
          lines
            .map((line) => line.sku?.trim())
            .filter((sku): sku is string => Boolean(sku)),
        ),
      ];
      const products = skuSet.length
        ? await this.prismaService.product.findMany({
            where: {
              accountId,
              sku: {
                in: skuSet,
              },
            },
            select: {
              id: true,
              sku: true,
            },
          })
        : [];
      const productBySku = new Map(
        products.map((product) => [product.sku, product]),
      );
      const customerName = this.getCustomerName(order);

      const localOrder = await this.prismaService.$transaction(async (tx) => {
        const upsertedOrder = await tx.order.upsert({
          where: {
            accountId_channel_channelOrderId: {
              accountId,
              channel: 'woocommerce',
              channelOrderId: order.id.toString(),
            },
          },
          create: {
            accountId,
            channel: 'woocommerce',
            channelOrderId: order.id.toString(),
            status: this.mapOrderStatus(order.status),
            orderedAt,
            customerName,
            customerEmail: order.billing?.email?.trim() || undefined,
            currencyCode: order.currency?.trim() || undefined,
            orderTotal: order.total
              ? new Prisma.Decimal(order.total)
              : undefined,
          },
          update: {
            status: this.mapOrderStatus(order.status),
            orderedAt,
            customerName,
            customerEmail: order.billing?.email?.trim() || null,
            currencyCode: order.currency?.trim() || null,
            orderTotal: order.total ? new Prisma.Decimal(order.total) : null,
          },
        });

        await tx.orderLine.deleteMany({
          where: {
            accountId,
            orderId: upsertedOrder.id,
          },
        });

        if (lines.length) {
          await tx.orderLine.createMany({
            data: lines.map((line) => {
              const sku = line.sku?.trim() || null;
              const product = sku ? productBySku.get(sku) : null;

              return {
                accountId,
                orderId: upsertedOrder.id,
                productId: product?.id ?? null,
                channelLineId: line.id.toString(),
                sku,
                productName: line.name?.trim() || null,
                quantity: new Prisma.Decimal(line.quantity ?? 0),
                unitPrice:
                  line.price !== null && line.price !== undefined
                    ? new Prisma.Decimal(line.price)
                    : undefined,
                lineTotal: line.total
                  ? new Prisma.Decimal(line.total)
                  : undefined,
              };
            }),
          });
        }

        return tx.order.findUniqueOrThrow({
          where: {
            id: upsertedOrder.id,
          },
          include: {
            orderLines: true,
          },
        });
      });

      synced.push({
        woocommerceId: order.id,
        orderId: localOrder.id.toString(),
        status: localOrder.status,
        lineCount: localOrder.orderLines.length,
        unmappedLineCount: localOrder.orderLines.filter(
          (line) => !line.productId,
        ).length,
        action: existing ? 'updated' : 'created',
      });
    }

    return {
      connectionId: config.connectionId,
      fetched: orders.length,
      synced: synced.length,
      skipped: skipped.length,
      items: synced,
      skippedItems: skipped,
    };
  }

  async postOrderInventoryImpact(accountId: bigint, locationCode = 'MAIN') {
    const orders = await this.prismaService.order.findMany({
      where: {
        accountId,
        channel: 'woocommerce',
        status: {
          in: INVENTORY_IMPACT_ORDER_STATUSES,
        },
      },
      include: {
        orderLines: true,
      },
      orderBy: {
        orderedAt: 'asc',
      },
    });
    const posted: PostedOrderInventorySummary[] = [];
    const skipped: Array<{
      orderId: string;
      channelOrderId: string;
      orderLineId: string;
      reason: string;
    }> = [];

    for (const order of orders) {
      for (const line of order.orderLines) {
        if (!line.productId) {
          skipped.push({
            orderId: order.id.toString(),
            channelOrderId: order.channelOrderId,
            orderLineId: line.id.toString(),
            reason: 'missing_product_mapping',
          });
          continue;
        }

        if (!line.channelLineId) {
          skipped.push({
            orderId: order.id.toString(),
            channelOrderId: order.channelOrderId,
            orderLineId: line.id.toString(),
            reason: 'missing_channel_line_id',
          });
          continue;
        }

        const result = await this.inventoryService.postExternalChannelSaleEvent(
          {
            accountId,
            orderLineId: line.id,
            locationCode,
          },
        );

        posted.push({
          orderId: order.id.toString(),
          channelOrderId: order.channelOrderId,
          orderLineId: line.id.toString(),
          channelLineId: line.channelLineId,
          productId: line.productId.toString(),
          action: result.action,
        });
      }
    }

    return {
      connectionId: WOOCOMMERCE_CONNECTION_ID,
      eligibleOrders: orders.length,
      posted: posted.filter((item) => item.action === 'created').length,
      alreadyPosted: posted.filter((item) => item.action === 'existing').length,
      skipped: skipped.length,
      items: posted,
      skippedItems: skipped,
    };
  }

  private async fetchAllProducts(
    config: WoocommerceRuntimeConfig,
  ): Promise<WoocommerceProduct[]> {
    const allProducts: WoocommerceProduct[] = [];

    for (let page = 1; page <= MAX_SYNC_PAGES; page += 1) {
      const products = await this.fetchProducts(
        {
          perPage: DEFAULT_SYNC_PAGE_SIZE,
          page,
        },
        config,
      );

      allProducts.push(...products);

      if (products.length < DEFAULT_SYNC_PAGE_SIZE) {
        break;
      }
    }

    return allProducts;
  }

  private async fetchAllOrders(
    config: WoocommerceRuntimeConfig,
  ): Promise<WoocommerceOrder[]> {
    const allOrders: WoocommerceOrder[] = [];

    for (let page = 1; page <= MAX_SYNC_PAGES; page += 1) {
      const orders = await this.fetchOrders(
        {
          perPage: DEFAULT_SYNC_PAGE_SIZE,
          page,
        },
        config,
      );

      allOrders.push(...orders);

      if (orders.length < DEFAULT_SYNC_PAGE_SIZE) {
        break;
      }
    }

    return allOrders;
  }

  private async fetchProducts(
    options: WoocommerceRequestOptions,
    config: WoocommerceRuntimeConfig,
  ): Promise<WoocommerceProduct[]> {
    const url = this.buildProductsUrl(config.storeUrl, options);
    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          Authorization: this.buildBasicAuthHeader(
            config.consumerKey,
            config.consumerSecret,
          ),
          Accept: 'application/json',
        },
      });
    } catch (error) {
      throw new BadGatewayException({
        message: 'WooCommerce products request could not be completed',
        error: error instanceof Error ? error.message : 'Unknown fetch error',
      });
    }

    if (!response.ok) {
      const responseText = await response.text();
      throw new BadGatewayException({
        message: 'WooCommerce products request failed',
        status: response.status,
        response: responseText.slice(0, 500),
      });
    }

    const body = (await response.json()) as unknown;
    if (!Array.isArray(body)) {
      throw new BadGatewayException(
        'WooCommerce products response was not an array',
      );
    }

    return body.map((item) => item as WoocommerceProduct);
  }

  private async fetchOrders(
    options: WoocommerceRequestOptions,
    config: WoocommerceRuntimeConfig,
  ): Promise<WoocommerceOrder[]> {
    const url = this.buildWoocommerceUrl(
      config.storeUrl,
      WOOCOMMERCE_ORDERS_PATH,
      options,
    );
    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          Authorization: this.buildBasicAuthHeader(
            config.consumerKey,
            config.consumerSecret,
          ),
          Accept: 'application/json',
        },
      });
    } catch (error) {
      throw new BadGatewayException({
        message: 'WooCommerce orders request could not be completed',
        error: error instanceof Error ? error.message : 'Unknown fetch error',
      });
    }

    if (!response.ok) {
      const responseText = await response.text();
      throw new BadGatewayException({
        message: 'WooCommerce orders request failed',
        status: response.status,
        response: responseText.slice(0, 500),
      });
    }

    const body = (await response.json()) as unknown;
    if (!Array.isArray(body)) {
      throw new BadGatewayException(
        'WooCommerce orders response was not an array',
      );
    }

    return body.map((item) => item as WoocommerceOrder);
  }

  private getConfig(input: { requireCredentials: boolean }) {
    const storeUrl = process.env.WOOCOMMERCE_DEMO_STORE_URL?.trim() || null;
    const consumerKey =
      process.env.WOOCOMMERCE_DEMO_CONSUMER_KEY?.trim() || null;
    const consumerSecret =
      process.env.WOOCOMMERCE_DEMO_CONSUMER_SECRET?.trim() || null;

    if (
      input.requireCredentials &&
      (!storeUrl || !consumerKey || !consumerSecret)
    ) {
      throw new BadRequestException(
        'WooCommerce demo store URL, consumer key, and consumer secret must be configured',
      );
    }

    return {
      connectionId: WOOCOMMERCE_CONNECTION_ID,
      storeUrl,
      consumerKey,
      consumerSecret,
    };
  }

  private async getConfigForAccount(
    accountId: bigint,
    connectionId?: bigint,
  ): Promise<WoocommerceRuntimeConfig> {
    const connection = await this.prismaService.ecommerceConnection.findFirst({
      where: {
        accountId,
        provider: EcommerceProvider.woocommerce,
        isActive: true,
        ...(connectionId ? { id: connectionId } : {}),
      },
      orderBy: {
        id: 'asc',
      },
    });

    if (!connection) {
      throw new BadRequestException('No active WooCommerce connection is configured');
    }

    const credentials = this.getCredentials(connection.credentials);

    if (
      !connection.storeUrl ||
      !credentials.consumerKey ||
      !credentials.consumerSecret
    ) {
      throw new BadRequestException(
        'WooCommerce store URL, consumer key, and consumer secret must be configured',
      );
    }

    return {
      connectionId: connection.id.toString(),
      storeUrl: connection.storeUrl,
      consumerKey: credentials.consumerKey,
      consumerSecret: credentials.consumerSecret,
    };
  }

  private buildProductsUrl(
    storeUrl: string | null,
    options: WoocommerceRequestOptions,
  ): string {
    if (!storeUrl) {
      throw new BadRequestException('WooCommerce demo store URL is not set');
    }

    return this.buildWoocommerceUrl(
      storeUrl,
      WOOCOMMERCE_PRODUCTS_PATH,
      options,
    );
  }

  private buildWoocommerceUrl(
    storeUrl: string | null,
    path: string,
    options: WoocommerceRequestOptions,
  ): string {
    if (!storeUrl) {
      throw new BadRequestException('WooCommerce demo store URL is not set');
    }

    const url = new URL(path, this.normalizeStoreUrl(storeUrl));
    if (options.perPage) {
      url.searchParams.set('per_page', options.perPage.toString());
    }
    if (options.page) {
      url.searchParams.set('page', options.page.toString());
    }

    return url.toString();
  }

  private getProductsEndpointForDisplay(
    config: WoocommerceRuntimeConfig,
  ): string {
    const url = new URL(
      WOOCOMMERCE_PRODUCTS_PATH,
      this.normalizeStoreUrl(config.storeUrl!),
    );
    return url.toString();
  }

  private getCredentials(credentials: Prisma.JsonValue): {
    consumerKey: string | null;
    consumerSecret: string | null;
  } {
    if (
      !credentials ||
      Array.isArray(credentials) ||
      typeof credentials !== 'object'
    ) {
      return {
        consumerKey: null,
        consumerSecret: null,
      };
    }

    return {
      consumerKey: this.getCredentialString(credentials, 'consumerKey'),
      consumerSecret: this.getCredentialString(credentials, 'consumerSecret'),
    };
  }

  private getCredentialString(
    credentials: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = credentials[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private normalizeStoreUrl(storeUrl: string): string {
    return storeUrl.endsWith('/') ? storeUrl : `${storeUrl}/`;
  }

  private buildBasicAuthHeader(
    consumerKey: string | null,
    consumerSecret: string | null,
  ): string {
    if (!consumerKey || !consumerSecret) {
      throw new BadRequestException('WooCommerce credentials are not set');
    }

    return `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
      'base64',
    )}`;
  }

  private mapProductStatus(status?: string | null): ProductStatus {
    if (status === 'publish') {
      return ProductStatus.active;
    }

    if (status === 'trash') {
      return ProductStatus.archived;
    }

    return ProductStatus.inactive;
  }

  private mapOrderStatus(status?: string | null): string {
    switch (status) {
      case 'pending':
        return 'pending';
      case 'on-hold':
        return 'on_hold';
      case 'processing':
        return 'processing';
      case 'completed':
        return 'completed';
      case 'cancelled':
      case 'failed':
        return 'cancelled';
      case 'refunded':
        return 'refunded';
      default:
        return 'pending';
    }
  }

  private getOrderDate(order: WoocommerceOrder): Date | null {
    const value = order.date_created_gmt || order.date_created;
    if (!value) return null;

    const normalized =
      order.date_created_gmt && !value.endsWith('Z') ? `${value}Z` : value;
    const date = new Date(normalized);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  private getCustomerName(order: WoocommerceOrder): string | undefined {
    const firstName = order.billing?.first_name?.trim();
    const lastName = order.billing?.last_name?.trim();
    const name = [firstName, lastName].filter(Boolean).join(' ');

    return name || undefined;
  }
}
