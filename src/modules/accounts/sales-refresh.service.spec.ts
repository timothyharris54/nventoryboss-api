import { Test, TestingModule } from '@nestjs/testing';
import { WoocommerceService } from 'src/modules/ecommerce/woocommerce/woocommerce.service';
import { ShopifyService } from 'src/modules/ecommerce/shopify/shopify.service';
import { ReplenishmentEngineService } from 'src/modules/planning/services/replenishment-engine.service';
import { SalesDailyService } from 'src/modules/planning/services/sales-daily.service';
import { SalesRefreshService } from './sales-refresh.service';

describe('SalesRefreshService', () => {
  let service: SalesRefreshService;

  const woocommerceServiceMock = {
    getConnections: jest.fn(),
    syncProducts: jest.fn(),
    syncInventoryLevels: jest.fn(),
    syncOrders: jest.fn(),
    postOrderInventoryImpact: jest.fn(),
  };

  const shopifyServiceMock = {
    getConnections: jest.fn(),
    syncProducts: jest.fn(),
    syncOrders: jest.fn(),
    postOrderInventoryImpact: jest.fn(),
  };

  const salesDailyServiceMock = {
    rebuildForAccount: jest.fn(),
  };

  const replenishmentEngineServiceMock = {
    generateForAccount: jest.fn(),
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-06T15:30:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesRefreshService,
        {
          provide: WoocommerceService,
          useValue: woocommerceServiceMock,
        },
        {
          provide: ShopifyService,
          useValue: shopifyServiceMock,
        },
        {
          provide: SalesDailyService,
          useValue: salesDailyServiceMock,
        },
        {
          provide: ReplenishmentEngineService,
          useValue: replenishmentEngineServiceMock,
        },
      ],
    }).compile();

    service = module.get<SalesRefreshService>(SalesRefreshService);

    jest.clearAllMocks();
    woocommerceServiceMock.getConnections.mockReturnValue([
      {
        id: '10',
        provider: 'woocommerce',
        label: 'WooCommerce demo store',
        storeUrl: 'https://example.test',
        configured: true,
      },
    ]);
    woocommerceServiceMock.syncProducts.mockResolvedValue({ synced: 2 });
    woocommerceServiceMock.syncInventoryLevels.mockResolvedValue({ synced: 2 });
    woocommerceServiceMock.syncOrders.mockResolvedValue({ synced: 3 });
    woocommerceServiceMock.postOrderInventoryImpact.mockResolvedValue({
      posted: 3,
    });
    shopifyServiceMock.getConnections.mockReturnValue([]);
    shopifyServiceMock.syncProducts.mockResolvedValue({ synced: 4 });
    shopifyServiceMock.syncOrders.mockResolvedValue({ synced: 5 });
    shopifyServiceMock.postOrderInventoryImpact.mockResolvedValue({
      posted: 5,
    });
    salesDailyServiceMock.rebuildForAccount.mockResolvedValue({
      deleted: 1,
      insertedEstimate: 2,
      statusesUsed: ['completed'],
    });
    replenishmentEngineServiceMock.generateForAccount.mockResolvedValue([
      { ok: true },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('syncs active channels, posts inventory impact, and rebuilds sales daily with the default lookback', async () => {
    const result = await service.refreshForAccount(1n);

    expect(woocommerceServiceMock.syncProducts).toHaveBeenCalledWith(1n, 10n, {
      locationCode: 'MAIN',
      reconcileInventory: false,
    });
    expect(woocommerceServiceMock.syncOrders).toHaveBeenCalledWith(1n, 10n);
    expect(
      woocommerceServiceMock.postOrderInventoryImpact,
    ).toHaveBeenCalledWith(1n, 'MAIN');
    expect(woocommerceServiceMock.syncInventoryLevels).toHaveBeenCalledWith(
      1n,
      10n,
      'MAIN',
    );
    expect(salesDailyServiceMock.rebuildForAccount).toHaveBeenCalledWith(
      1n,
      new Date('2026-02-06T00:00:00.000Z'),
      new Date('2026-06-06T15:30:00.000Z'),
    );
    expect(
      replenishmentEngineServiceMock.generateForAccount,
    ).not.toHaveBeenCalled();
    expect(result.lookbackDays).toBe(120);
    expect(result.channels).toHaveLength(1);
    expect(result.replenishment).toBeNull();
  });

  it('runs replenishment when requested', async () => {
    const result = await service.refreshForAccount(1n, {
      runReplenishment: true,
      dryRunReplenishment: true,
      locationCode: 'WEST',
      lookbackDays: 30,
    });

    expect(salesDailyServiceMock.rebuildForAccount).toHaveBeenCalledWith(
      1n,
      new Date('2026-05-07T00:00:00.000Z'),
      new Date('2026-06-06T15:30:00.000Z'),
    );
    expect(
      replenishmentEngineServiceMock.generateForAccount,
    ).toHaveBeenCalledWith(1n, 'WEST', true);
    expect(result.replenishment).toEqual([{ ok: true }]);
  });

  it('skips unconfigured channels', async () => {
    woocommerceServiceMock.getConnections.mockReturnValue([
      {
        id: '10',
        provider: 'woocommerce',
        label: 'WooCommerce demo store',
        storeUrl: null,
        configured: false,
      },
    ]);

    const result = await service.refreshForAccount(1n);

    expect(woocommerceServiceMock.syncProducts).not.toHaveBeenCalled();
    expect(woocommerceServiceMock.syncOrders).not.toHaveBeenCalled();
    expect(
      woocommerceServiceMock.postOrderInventoryImpact,
    ).not.toHaveBeenCalled();
    expect(salesDailyServiceMock.rebuildForAccount).toHaveBeenCalled();
    expect(result.channels).toEqual([]);
  });

  it('syncs configured Shopify connections', async () => {
    shopifyServiceMock.getConnections.mockReturnValue([
      {
        id: '20',
        provider: 'shopify',
        label: 'Shopify store',
        storeUrl: 'https://example.myshopify.com',
        configured: true,
        channelKey: 'shopify-main',
      },
    ]);

    const result = await service.refreshForAccount(1n);

    expect(shopifyServiceMock.syncProducts).toHaveBeenCalledWith(1n, 20n);
    expect(shopifyServiceMock.syncOrders).toHaveBeenCalledWith(1n, 20n);
    expect(shopifyServiceMock.postOrderInventoryImpact).toHaveBeenCalledWith(
      1n,
      'MAIN',
    );
    expect(result.channels).toHaveLength(2);
  });

  it('refreshes only the requested configured connection', async () => {
    shopifyServiceMock.getConnections.mockReturnValue([
      {
        id: '20',
        provider: 'shopify',
        label: 'Shopify store',
        storeUrl: 'https://example.myshopify.com',
        configured: true,
        channelKey: 'shopify-main',
      },
    ]);

    const result = await service.refreshForAccount(1n, { connectionId: '20' });

    expect(woocommerceServiceMock.syncProducts).not.toHaveBeenCalled();
    expect(shopifyServiceMock.syncProducts).toHaveBeenCalledWith(1n, 20n);
    expect(result.channels).toHaveLength(1);
  });

  it('skips an unconfigured Shopify connection', async () => {
    shopifyServiceMock.getConnections.mockReturnValue([
      {
        id: '20',
        provider: 'shopify',
        label: 'Shopify store',
        storeUrl: null,
        configured: false,
        channelKey: 'shopify-main',
      },
    ]);

    await expect(
      service.refreshForAccount(1n, { connectionId: '20' }),
    ).rejects.toThrow(
      'The selected ecommerce connection is inactive, missing credentials, or unavailable for this account',
    );

    expect(shopifyServiceMock.syncProducts).not.toHaveBeenCalled();
    expect(shopifyServiceMock.syncOrders).not.toHaveBeenCalled();
    expect(shopifyServiceMock.postOrderInventoryImpact).not.toHaveBeenCalled();
  });
});
