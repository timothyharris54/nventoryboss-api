import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { EcommerceProvider, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { InventoryService } from 'src/modules/inventory/inventory.service';
import { SubscriptionService } from 'src/modules/accounts/subscription.service';

type ShopifyConfig = {
  connectionId: string;
  storeUrl: string;
  accessToken: string | null;
  clientId: string | null;
  clientSecret: string | null;
  apiVersion: string;
  defaultLocationCode: string;
};

type ShopifyConnection = {
  id: string;
  provider: 'shopify';
  label: string;
  storeUrl: string | null;
  configured: boolean;
  channelKey: string;
};

type PageInfo = { hasNextPage: boolean; endCursor?: string | null };
type ShopifyProductsData = {
  products: { nodes: ShopifyProduct[]; pageInfo: PageInfo };
};
type ShopifyOrdersData = {
  orders: { nodes: ShopifyOrder[]; pageInfo: PageInfo };
};
type ShopifyProduct = {
  id: string;
  title: string;
  status: string;
  productType?: string | null;
  featuredMedia?: {
    preview?: { image?: { url?: string | null } | null } | null;
  } | null;
  variants: {
    nodes: Array<{ id: string; title: string; sku?: string | null }>;
  };
};
type ShopifyOrder = {
  id: string;
  legacyResourceId?: string | null;
  name: string;
  createdAt: string;
  displayFinancialStatus?: string | null;
  displayFulfillmentStatus?: string | null;
  currencyCode?: string | null;
  totalPriceSet?: { shopMoney?: { amount?: string | null } | null } | null;
  customer?: { displayName?: string | null; email?: string | null } | null;
  email?: string | null;
  lineItems: {
    nodes: Array<{
      id: string;
      name: string;
      quantity: number;
      sku?: string | null;
      originalUnitPriceSet?: {
        shopMoney?: { amount?: string | null } | null;
      } | null;
    }>;
  };
};

const DEFAULT_API_VERSION = '2026-07';
const PAGE_SIZE = 100;
const MAX_PAGES = 25;
const INVENTORY_IMPACT_ORDER_STATUSES = [
  'paid',
  'partially_paid',
  'fulfilled',
  'partially_fulfilled',
];

@Injectable()
export class ShopifyService {
  private readonly tokens = new Map<
    string,
    { accessToken: string; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async getConnections(accountId: bigint): Promise<ShopifyConnection[]> {
    const connections = await this.prisma.ecommerceConnection.findMany({
      where: {
        accountId,
        provider: EcommerceProvider.shopify,
        isActive: true,
      },
      orderBy: { id: 'asc' },
    });

    return connections.map((connection) => {
      const credentials = this.objectValue(connection.credentials);
      const accessToken = this.stringValue(credentials, 'accessToken');
      const clientId = this.stringValue(credentials, 'clientId');
      const clientSecret = this.stringValue(credentials, 'clientSecret');

      return {
        id: connection.id.toString(),
        provider: 'shopify',
        label: connection.displayName,
        storeUrl: connection.storeUrl,
        configured: Boolean(
          connection.storeUrl &&
          (accessToken || (clientId && clientSecret)),
        ),
        channelKey: connection.channelKey,
      };
    });
  }

  async testConnection(accountId: bigint, connectionId?: bigint) {
    await this.subscriptionService.requireFeature(accountId, 'shopify_sync');
    const config = await this.getConfig(accountId, connectionId);
    try {
      const data = await this.graphql<{
        shop: { id: string; name: string; myshopifyDomain: string };
      }>(config, `query ConnectionTest { shop { id name myshopifyDomain } }`);
      await this.recordConnectionTest(BigInt(config.connectionId), 'connected');
      return { connectionId: config.connectionId, ok: true, shop: data.shop };
    } catch (error) {
      await this.recordConnectionTest(
        BigInt(config.connectionId),
        'failed',
        error instanceof Error ? error.message : 'Unknown Shopify error',
      );
      throw error;
    }
  }

  async syncProducts(accountId: bigint, connectionId?: bigint) {
    await this.subscriptionService.requireFeature(accountId, 'shopify_sync');
    const config = await this.getConfig(accountId, connectionId);
    const products = await this.fetchAllProducts(config);
    const items: Array<Record<string, unknown>> = [];
    const skippedItems: Array<Record<string, unknown>> = [];

    for (const product of products) {
      const categoryName = product.productType?.trim();
      const category = categoryName
        ? await this.prisma.productCategory.upsert({
            where: { accountId_name: { accountId, name: categoryName } },
            create: { accountId, name: categoryName },
            update: {},
          })
        : null;
      const variants = product.variants.nodes;
      for (const variant of variants) {
        const sku = variant.sku?.trim();
        if (!sku) {
          skippedItems.push({
            shopifyProductId: product.id,
            shopifyVariantId: variant.id,
            reason: 'missing_sku',
          });
          continue;
        }

        const existing = await this.prisma.product.findUnique({
          where: { accountId_sku: { accountId, sku } },
        });
        const isVariant =
          variants.length > 1 || variant.title !== 'Default Title';
        const name = isVariant
          ? `${product.title} - ${variant.title}`
          : product.title;
        const imageUrl = product.featuredMedia?.preview?.image?.url?.trim();
        const localProduct = await this.prisma.product.upsert({
          where: { accountId_sku: { accountId, sku } },
          create: {
            accountId,
            sku,
            name,
            status: this.mapProductStatus(product.status),
            isVariant,
            ...(category ? { categoryId: category.id } : {}),
            ...(imageUrl ? { imageUrl } : {}),
          },
          update: {
            name,
            status: this.mapProductStatus(product.status),
            isVariant,
            ...(category ? { categoryId: category.id } : {}),
            ...(imageUrl ? { imageUrl } : {}),
          },
        });
        await this.prisma.ecommerceProductMapping.upsert({
          where: {
            accountId_connectionId_externalProductId_externalVariantId: {
              accountId,
              connectionId: BigInt(config.connectionId),
              externalProductId: product.id,
              externalVariantId: variant.id,
            },
          },
          create: {
            accountId,
            connectionId: BigInt(config.connectionId),
            productId: localProduct.id,
            provider: EcommerceProvider.shopify,
            externalProductId: product.id,
            externalVariantId: variant.id,
            externalSku: sku,
            externalName: name,
            lastSyncedAt: new Date(),
          },
          update: {
            productId: localProduct.id,
            externalSku: sku,
            externalName: name,
            lastSyncedAt: new Date(),
          },
        });
        items.push({
          shopifyProductId: product.id,
          shopifyVariantId: variant.id,
          productId: localProduct.id.toString(),
          sku,
          name,
          action: existing ? 'updated' : 'created',
        });
      }
    }

    await this.markSynced(BigInt(config.connectionId));
    return {
      connectionId: config.connectionId,
      fetched: products.length,
      synced: items.length,
      skipped: skippedItems.length,
      items,
      skippedItems,
    };
  }

  async syncOrders(accountId: bigint, connectionId?: bigint) {
    await this.subscriptionService.requireFeature(accountId, 'shopify_sync');
    const config = await this.getConfig(accountId, connectionId);
    const orders = await this.fetchAllOrders(config);
    const items: Array<Record<string, unknown>> = [];
    const skippedItems: Array<Record<string, unknown>> = [];

    for (const order of orders) {
      const orderedAt = new Date(order.createdAt);
      const channelOrderId = order.legacyResourceId || order.id;
      if (Number.isNaN(orderedAt.getTime())) {
        skippedItems.push({
          shopifyOrderId: channelOrderId,
          reason: 'missing_order_date',
        });
        continue;
      }
      const existing = await this.prisma.order.findUnique({
        where: {
          accountId_channel_channelOrderId: {
            accountId,
            channel: 'shopify',
            channelOrderId,
          },
        },
      });
      const lines = order.lineItems.nodes;
      const skus = [
        ...new Set(
          lines
            .map((line) => line.sku?.trim())
            .filter((sku): sku is string => Boolean(sku)),
        ),
      ];
      const products = skus.length
        ? await this.prisma.product.findMany({
            where: { accountId, sku: { in: skus } },
            select: { id: true, sku: true },
          })
        : [];
      const productBySku = new Map(
        products.map((product) => [product.sku, product]),
      );
      const status = this.mapOrderStatus(order);
      const localOrder = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.order.upsert({
          where: {
            accountId_channel_channelOrderId: {
              accountId,
              channel: 'shopify',
              channelOrderId,
            },
          },
          create: {
            accountId,
            channel: 'shopify',
            channelOrderId,
            status,
            orderedAt,
            customerName: order.customer?.displayName?.trim() || undefined,
            customerEmail:
              order.customer?.email?.trim() || order.email?.trim() || undefined,
            currencyCode: order.currencyCode || undefined,
            orderTotal: order.totalPriceSet?.shopMoney?.amount
              ? new Prisma.Decimal(order.totalPriceSet.shopMoney.amount)
              : undefined,
          },
          update: {
            status,
            orderedAt,
            customerName: order.customer?.displayName?.trim() || null,
            customerEmail:
              order.customer?.email?.trim() || order.email?.trim() || null,
            currencyCode: order.currencyCode || null,
            orderTotal: order.totalPriceSet?.shopMoney?.amount
              ? new Prisma.Decimal(order.totalPriceSet.shopMoney.amount)
              : null,
          },
        });
        await tx.orderLine.deleteMany({
          where: { accountId, orderId: saved.id },
        });
        if (lines.length) {
          await tx.orderLine.createMany({
            data: lines.map((line) => {
              const sku = line.sku?.trim() || null;
              const unitPrice = line.originalUnitPriceSet?.shopMoney?.amount;
              return {
                accountId,
                orderId: saved.id,
                productId: sku ? (productBySku.get(sku)?.id ?? null) : null,
                channelLineId: line.id,
                sku,
                productName: line.name?.trim() || null,
                quantity: new Prisma.Decimal(line.quantity),
                unitPrice: unitPrice
                  ? new Prisma.Decimal(unitPrice)
                  : undefined,
                lineTotal: unitPrice
                  ? new Prisma.Decimal(unitPrice).mul(line.quantity)
                  : undefined,
              };
            }),
          });
        }
        return tx.order.findUniqueOrThrow({
          where: { id: saved.id },
          include: { orderLines: true },
        });
      });
      items.push({
        shopifyOrderId: channelOrderId,
        orderId: localOrder.id.toString(),
        status: localOrder.status,
        lineCount: localOrder.orderLines.length,
        unmappedLineCount: localOrder.orderLines.filter(
          (line) => !line.productId,
        ).length,
        action: existing ? 'updated' : 'created',
      });
    }
    await this.markSynced(BigInt(config.connectionId));
    return {
      connectionId: config.connectionId,
      fetched: orders.length,
      synced: items.length,
      skipped: skippedItems.length,
      items,
      skippedItems,
    };
  }

  async postOrderInventoryImpact(accountId: bigint, locationCode = 'MAIN') {
    await this.subscriptionService.requireFeature(accountId, 'shopify_sync');
    const orders = await this.prisma.order.findMany({
      where: {
        accountId,
        channel: 'shopify',
        status: { in: INVENTORY_IMPACT_ORDER_STATUSES },
      },
      include: { orderLines: true },
      orderBy: { orderedAt: 'asc' },
    });
    const items: Array<Record<string, unknown>> = [];
    const skippedItems: Array<Record<string, unknown>> = [];
    for (const order of orders) {
      for (const line of order.orderLines) {
        if (!line.productId || !line.channelLineId) {
          skippedItems.push({
            orderId: order.id.toString(),
            channelOrderId: order.channelOrderId,
            orderLineId: line.id.toString(),
            reason: !line.productId
              ? 'missing_product_mapping'
              : 'missing_channel_line_id',
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
        items.push({
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
      connectionId: 'shopify',
      eligibleOrders: orders.length,
      posted: items.filter((item) => item.action === 'created').length,
      alreadyPosted: items.filter((item) => item.action === 'existing').length,
      skipped: skippedItems.length,
      items,
      skippedItems,
    };
  }

  private async fetchAllProducts(
    config: ShopifyConfig,
  ): Promise<ShopifyProduct[]> {
    const products: ShopifyProduct[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const data: ShopifyProductsData = await this.graphql<ShopifyProductsData>(
        config,
        `query Products($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          nodes { id title status productType featuredMedia { preview { image { url } } } variants(first: 100) { nodes { id title sku } } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
        { first: PAGE_SIZE, after: cursor },
      );
      products.push(...data.products.nodes);
      if (!data.products.pageInfo.hasNextPage) break;
      cursor = data.products.pageInfo.endCursor || null;
      if (!cursor) break;
    }
    return products;
  }

  private async fetchAllOrders(config: ShopifyConfig): Promise<ShopifyOrder[]> {
    const orders: ShopifyOrder[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const data: ShopifyOrdersData = await this.graphql<ShopifyOrdersData>(
        config,
        `query Orders($first: Int!, $after: String) {
        orders(first: $first, after: $after, sortKey: CREATED_AT) {
          nodes {
            id legacyResourceId name createdAt displayFinancialStatus displayFulfillmentStatus currencyCode
            totalPriceSet { shopMoney { amount } }
            customer { displayName email }
            email
            lineItems(first: 100) { nodes { id name quantity sku originalUnitPriceSet { shopMoney { amount } } } }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
        { first: PAGE_SIZE, after: cursor },
      );
      orders.push(...data.orders.nodes);
      if (!data.orders.pageInfo.hasNextPage) break;
      cursor = data.orders.pageInfo.endCursor || null;
      if (!cursor) break;
    }
    return orders;
  }

  private async graphql<T>(
    config: ShopifyConfig,
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const token = await this.getAccessToken(config);
    let response: Response;
    try {
      response = await fetch(
        `${config.storeUrl}/admin/api/${config.apiVersion}/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Shopify-Access-Token': token,
          },
          body: JSON.stringify({ query, variables }),
        },
      );
    } catch (error) {
      throw new BadGatewayException({
        message: 'Shopify Admin API request could not be completed',
        error: error instanceof Error ? error.message : 'Unknown fetch error',
      });
    }
    if (!response.ok) {
      throw new BadGatewayException({
        message: 'Shopify Admin API request failed',
        status: response.status,
        response: (await response.text()).slice(0, 500),
      });
    }
    const body = (await response.json()) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    };
    if (body.errors?.length || !body.data) {
      throw new BadGatewayException({
        message: 'Shopify Admin API returned GraphQL errors',
        errors: body.errors?.map((error) => error.message) ?? ['Missing data'],
      });
    }
    return body.data;
  }

  private async getAccessToken(config: ShopifyConfig): Promise<string> {
    if (config.accessToken) return config.accessToken;

    if (!config.clientId || !config.clientSecret) {
      throw new BadRequestException(
        'Shopify Admin API access token or client ID and client secret must be configured',
      );
    }

    const cached = this.tokens.get(config.connectionId);
    if (cached && cached.expiresAt > Date.now() + 60_000)
      return cached.accessToken;
    let response: Response;
    try {
      response = await fetch(`${config.storeUrl}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }).toString(),
      });
    } catch (error) {
      throw new BadGatewayException({
        message: 'Shopify access token request could not be completed',
        error: error instanceof Error ? error.message : 'Unknown fetch error',
      });
    }
    if (!response.ok) {
      throw new BadGatewayException({
        message: 'Shopify access token request failed',
        status: response.status,
        response: (await response.text()).slice(0, 500),
      });
    }
    const body = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!body.access_token)
      throw new BadGatewayException(
        'Shopify token response did not contain an access token',
      );
    this.tokens.set(config.connectionId, {
      accessToken: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 86400) * 1000,
    });
    return body.access_token;
  }

  private async getConfig(
    accountId: bigint,
    connectionId?: bigint,
  ): Promise<ShopifyConfig> {
    const connection = await this.prisma.ecommerceConnection.findFirst({
      where: {
        accountId,
        provider: EcommerceProvider.shopify,
        isActive: true,
        ...(connectionId ? { id: connectionId } : {}),
      },
      orderBy: { id: 'asc' },
    });
    if (!connection)
      throw new BadRequestException(
        'No active Shopify connection is configured',
      );
    const credentials = this.objectValue(connection.credentials);
    const settings = this.objectValue(connection.settings);
    const accessToken = this.stringValue(credentials, 'accessToken');
    const clientId = this.stringValue(credentials, 'clientId');
    const clientSecret = this.stringValue(credentials, 'clientSecret');
    if (
      !connection.storeUrl ||
      (!accessToken && (!clientId || !clientSecret))
    ) {
      throw new BadRequestException(
        'Shopify store URL and either an Admin API access token or client ID and client secret must be configured',
      );
    }
    return {
      connectionId: connection.id.toString(),
      storeUrl: this.normalizeStoreUrl(connection.storeUrl),
      accessToken,
      clientId,
      clientSecret,
      apiVersion:
        this.stringValue(settings, 'apiVersion') || DEFAULT_API_VERSION,
      defaultLocationCode: connection.defaultLocationCode,
    };
  }

  private normalizeStoreUrl(value: string): string {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new BadRequestException('Shopify store URL is invalid');
    }
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.myshopify.com')) {
      throw new BadRequestException(
        'Shopify store URL must be an HTTPS myshopify.com domain',
      );
    }
    return `https://${url.hostname}`;
  }

  private objectValue(value: Prisma.JsonValue): Record<string, unknown> {
    return value && !Array.isArray(value) && typeof value === 'object'
      ? value
      : {};
  }

  private stringValue(
    value: Record<string, unknown>,
    key: string,
  ): string | null {
    const candidate = value[key];
    return typeof candidate === 'string' && candidate.trim()
      ? candidate.trim()
      : null;
  }

  private mapProductStatus(status: string): ProductStatus {
    if (status === 'ACTIVE') return ProductStatus.active;
    if (status === 'ARCHIVED') return ProductStatus.archived;
    return ProductStatus.inactive;
  }

  private mapOrderStatus(order: ShopifyOrder): string {
    const fulfillment = order.displayFulfillmentStatus?.toLowerCase();
    if (fulfillment && fulfillment !== 'unfulfilled') return fulfillment;
    return order.displayFinancialStatus?.toLowerCase() || 'unknown';
  }

  private async recordConnectionTest(
    id: bigint,
    status: string,
    error?: string,
  ) {
    await this.prisma.ecommerceConnection.update({
      where: { id },
      data: {
        lastConnectionTestedAt: new Date(),
        lastConnectionStatus: status,
        lastConnectionError: error ?? null,
      },
    });
  }

  private async markSynced(id: bigint) {
    await this.prisma.ecommerceConnection.update({
      where: { id },
      data: { lastSyncedAt: new Date() },
    });
  }
}
