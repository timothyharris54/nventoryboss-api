import { Injectable, NotFoundException } from '@nestjs/common';
import { EcommerceAuthType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CreateEcommerceConnectionDto } from './dto/create-ecommerce-connection.dto';
import { UpdateEcommerceConnectionDto } from './dto/update-ecommerce-connection.dto';

type EcommerceConnectionRecord =
  Prisma.EcommerceConnectionGetPayload<object>;

type EcommerceConnectionResponse = Omit<
  EcommerceConnectionRecord,
  'credentials'
> & {
  hasCredentials: boolean;
  credentialKeys: string[];
};

@Injectable()
export class EcommerceConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    accountId: bigint;
    dto: CreateEcommerceConnectionDto;
  }): Promise<EcommerceConnectionResponse> {
    const { accountId, dto } = input;
    const connection = await this.prisma.ecommerceConnection.create({
      data: {
        accountId,
        provider: dto.provider,
        channelKey: this.normalizeChannelKey(
          dto.channelKey ?? `${dto.provider}-${dto.displayName}`,
        ),
        displayName: dto.displayName.trim(),
        storeUrl: this.trimOptional(dto.storeUrl),
        externalStoreId: this.trimOptional(dto.externalStoreId),
        authType: dto.authType ?? EcommerceAuthType.api_key,
        credentials: this.toJsonInput(dto.credentials),
        settings: this.toJsonInput(dto.settings),
        defaultLocationCode:
          this.trimOptional(dto.defaultLocationCode) ?? 'MAIN',
        currencyCode: this.trimOptional(dto.currencyCode)?.toUpperCase(),
        isActive: dto.isActive ?? true,
      },
    });

    return this.toResponse(connection);
  }

  async findAll(accountId: bigint): Promise<EcommerceConnectionResponse[]> {
    const connections = await this.prisma.ecommerceConnection.findMany({
      where: {
        accountId,
      },
      orderBy: {
        id: 'asc',
      },
    });

    return connections.map((connection) => this.toResponse(connection));
  }

  async findOne(input: {
    accountId: bigint;
    id: bigint;
  }): Promise<EcommerceConnectionResponse> {
    const connection = await this.getConnectionOrThrow(input);
    return this.toResponse(connection);
  }

  async update(input: {
    accountId: bigint;
    id: bigint;
    dto: UpdateEcommerceConnectionDto;
  }): Promise<EcommerceConnectionResponse> {
    await this.getConnectionOrThrow({
      accountId: input.accountId,
      id: input.id,
    });

    const connection = await this.prisma.ecommerceConnection.update({
      where: {
        id: input.id,
        accountId: input.accountId,
      },
      data: this.toUpdateData(input.dto),
    });

    return this.toResponse(connection);
  }

  private async getConnectionOrThrow(input: {
    accountId: bigint;
    id: bigint;
  }): Promise<EcommerceConnectionRecord> {
    const connection = await this.prisma.ecommerceConnection.findFirst({
      where: {
        id: input.id,
        accountId: input.accountId,
      },
    });

    if (!connection) {
      throw new NotFoundException('Ecommerce connection not found');
    }

    return connection;
  }

  private toUpdateData(
    dto: UpdateEcommerceConnectionDto,
  ): Prisma.EcommerceConnectionUpdateInput {
    return {
      provider: dto.provider,
      channelKey: dto.channelKey
        ? this.normalizeChannelKey(dto.channelKey)
        : undefined,
      displayName: dto.displayName?.trim(),
      storeUrl:
        dto.storeUrl === undefined ? undefined : this.trimOptional(dto.storeUrl),
      externalStoreId:
        dto.externalStoreId === undefined
          ? undefined
          : this.trimOptional(dto.externalStoreId),
      authType: dto.authType,
      credentials:
        dto.credentials === undefined
          ? undefined
          : this.toJsonInput(dto.credentials),
      settings:
        dto.settings === undefined ? undefined : this.toJsonInput(dto.settings),
      defaultLocationCode:
        dto.defaultLocationCode === undefined
          ? undefined
          : (this.trimOptional(dto.defaultLocationCode) ?? 'MAIN'),
      currencyCode:
        dto.currencyCode === undefined
          ? undefined
          : this.trimOptional(dto.currencyCode)?.toUpperCase(),
      isActive: dto.isActive,
    };
  }

  private toResponse(
    connection: EcommerceConnectionRecord,
  ): EcommerceConnectionResponse {
    const { credentials, ...safeConnection } = connection;
    const credentialKeys = this.getCredentialKeys(credentials);

    return {
      ...safeConnection,
      hasCredentials: credentialKeys.length > 0,
      credentialKeys,
    };
  }

  private getCredentialKeys(credentials: Prisma.JsonValue): string[] {
    if (
      !credentials ||
      Array.isArray(credentials) ||
      typeof credentials !== 'object'
    ) {
      return [];
    }

    return Object.keys(credentials).sort();
  }

  private toJsonInput(
    value: Record<string, unknown> | undefined,
  ): Prisma.InputJsonValue | undefined {
    return value as Prisma.InputJsonValue | undefined;
  }

  private trimOptional(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private normalizeChannelKey(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || 'default';
  }
}
