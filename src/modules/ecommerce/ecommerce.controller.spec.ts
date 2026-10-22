import { UserRoleCode } from '@prisma/client';
import { CHANNEL_SYNCHRONIZATION_ROLES } from 'src/modules/auth/constants/channel-synchronization-roles';
import { ROLES_KEY } from 'src/modules/auth/decorators/roles.decorator';
import type { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';
import { EcommerceConnectionsService } from './ecommerce-connections.service';
import { EcommerceController } from './ecommerce.controller';
import { ShopifyService } from './shopify/shopify.service';
import { WoocommerceService } from './woocommerce/woocommerce.service';

function getRoles(methodName: string): UserRoleCode[] {
  const handler = Object.getOwnPropertyDescriptor(
    EcommerceController.prototype,
    methodName,
  )?.value as object;

  return Reflect.getMetadata(ROLES_KEY, handler) as UserRoleCode[];
}

describe('EcommerceController', () => {
  const ecommerceConnectionsServiceMock = {
    findAll: jest.fn(),
  };

  const controller = new EcommerceController(
    ecommerceConnectionsServiceMock as unknown as EcommerceConnectionsService,
    {} as WoocommerceService,
    {} as ShopifyService,
  );

  const plannerIdentity: RequestIdentity = {
    userId: 10n,
    accountId: 7n,
    email: 'planner@example.com',
    roleCode: UserRoleCode.planner,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('restricts configured connections to channel synchronization roles', () => {
    expect(getRoles('getConnections')).toEqual(CHANNEL_SYNCHRONIZATION_ROLES);
  });

  it('lists only connections for the current account', async () => {
    ecommerceConnectionsServiceMock.findAll.mockResolvedValue([]);

    await expect(controller.getConnections(plannerIdentity)).resolves.toEqual(
      [],
    );
    expect(ecommerceConnectionsServiceMock.findAll).toHaveBeenCalledWith(7n);
  });

  it('keeps connection configuration restricted to administrators', () => {
    expect(getRoles('createConnection')).toEqual([
      UserRoleCode.system_admin,
      UserRoleCode.account_admin,
    ]);
    expect(getRoles('updateConnection')).toEqual([
      UserRoleCode.system_admin,
      UserRoleCode.account_admin,
    ]);
  });

  it('restricts direct synchronization endpoints to the same roles', () => {
    const synchronizationMethods = [
      'syncWoocommerceProducts',
      'syncWoocommerceOrders',
      'postWoocommerceOrderInventoryImpact',
      'syncShopifyProducts',
      'syncShopifyOrders',
      'postShopifyOrderInventoryImpact',
    ];

    for (const methodName of synchronizationMethods) {
      expect(getRoles(methodName)).toEqual(CHANNEL_SYNCHRONIZATION_ROLES);
    }
  });
});
