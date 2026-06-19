import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { CreateVendorPlatformDto } from './dto/create-vendor-platform.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UpdateVendorPlatformDto } from './dto/update-vendor-platform.dto';

type VendorInput = {
  accountId: bigint;
  createVendorDto: CreateVendorDto;
};

type VendorPlatformRecord = Prisma.VendorPlatformGetPayload<object>;

type VendorPlatformResponse = Omit<VendorPlatformRecord, 'credentials'> & {
  hasCredentials: boolean;
  credentialKeys: string[];
};

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: VendorInput) {
    const accountId = input.accountId;
    const dto = input.createVendorDto;
    const platformId = await this.resolvePlatformId(accountId, dto.platformId);

    return this.prisma.vendor.create({
      data: {
        accountId,
        platformId,
        name: dto.name,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        defaultLeadTimeDays: dto.defaultLeadTimeDays,
        paymentTerms: dto.paymentTerms,
        isActive: dto.isActive ?? true,
        notes: dto.notes,
      },
    });
  }

  async findAll(accountId: bigint) {
    return this.prisma.vendor.findMany({
      where: {
        accountId,
      },
      include: {
        platform: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  async update(input: {
    accountId: bigint;
    id: bigint;
    updateVendorDto: UpdateVendorDto;
  }) {
    const { accountId, id, updateVendorDto } = input;

    // Check if the vendor exists and belongs to the account
    const existingVendor = await this.prisma.vendor.findFirst({
      where: {
        id,
        accountId,
      },
    }); // Changed to lowercase
    if (!existingVendor) {
      throw new NotFoundException('Vendor not found');
    }

    return this.prisma.vendor.update({
      where: {
        id,
        accountId,
      },
      data: await this.toVendorUpdateData(accountId, updateVendorDto),
      include: {
        platform: true,
      },
    });
  }

  async createPlatform(input: {
    accountId: bigint;
    dto: CreateVendorPlatformDto;
  }): Promise<VendorPlatformResponse> {
    try {
      const platform = await this.prisma.vendorPlatform.create({
        data: this.toPlatformCreateData(input.accountId, input.dto),
      });

      return this.toPlatformResponse(platform);
    } catch (error) {
      this.handlePlatformPrismaError(error);
      throw error;
    }
  }

  async findAllPlatforms(accountId: bigint): Promise<VendorPlatformResponse[]> {
    const platforms = await this.prisma.vendorPlatform.findMany({
      where: {
        accountId,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return platforms.map((platform) => this.toPlatformResponse(platform));
  }

  async updatePlatform(input: {
    accountId: bigint;
    id: bigint;
    dto: UpdateVendorPlatformDto;
  }): Promise<VendorPlatformResponse> {
    const existingPlatform = await this.prisma.vendorPlatform.findFirst({
      where: {
        id: input.id,
        accountId: input.accountId,
      },
    });

    if (!existingPlatform) {
      throw new NotFoundException('Vendor platform not found');
    }

    try {
      const platform = await this.prisma.vendorPlatform.update({
        where: {
          id: input.id,
          accountId: input.accountId,
        },
        data: this.toPlatformUpdateData(input.dto),
      });

      return this.toPlatformResponse(platform);
    } catch (error) {
      this.handlePlatformPrismaError(error);
      throw error;
    }
  }

  private async resolvePlatformId(
    accountId: bigint,
    platformId: string | undefined,
  ): Promise<bigint | null | undefined> {
    if (platformId === undefined) return undefined;
    if (!platformId.trim()) return null;

    const id = BigInt(platformId);
    const platform = await this.prisma.vendorPlatform.findFirst({
      where: {
        id,
        accountId,
      },
      select: {
        id: true,
      },
    });

    if (!platform) {
      throw new BadRequestException('Vendor platform is not valid');
    }

    return platform.id;
  }

  private async toVendorUpdateData(
    accountId: bigint,
    dto: UpdateVendorDto,
  ): Promise<Prisma.VendorUpdateInput> {
    const { platformId, ...vendorData } = dto;

    if (platformId === undefined) {
      return vendorData;
    }

    const resolvedPlatformId = await this.resolvePlatformId(accountId, platformId);

    return {
      ...vendorData,
      platform:
        resolvedPlatformId === null
          ? {
              disconnect: true,
            }
          : {
              connect: {
                id: resolvedPlatformId,
              },
            },
    };
  }

  private toPlatformCreateData(
    accountId: bigint,
    dto: CreateVendorPlatformDto,
  ): Prisma.VendorPlatformUncheckedCreateInput {
    return {
      accountId,
      name: dto.name.trim(),
      websiteUrl: this.trimOptional(dto.websiteUrl),
      loginUrl: this.trimOptional(dto.loginUrl),
      username: this.trimOptional(dto.username),
      credentials: this.toJsonInput(dto.credentials),
      paymentTerms: this.trimOptional(dto.paymentTerms),
      contactName: this.trimOptional(dto.contactName),
      contactEmail: this.trimOptional(dto.contactEmail),
      contactPhone: this.trimOptional(dto.contactPhone),
      notes: this.trimOptional(dto.notes),
      isActive: dto.isActive ?? true,
    };
  }

  private toPlatformUpdateData(
    dto: UpdateVendorPlatformDto,
  ): Prisma.VendorPlatformUpdateInput {
    return {
      name: dto.name?.trim(),
      websiteUrl:
        dto.websiteUrl === undefined
          ? undefined
          : this.trimOptional(dto.websiteUrl),
      loginUrl:
        dto.loginUrl === undefined ? undefined : this.trimOptional(dto.loginUrl),
      username:
        dto.username === undefined ? undefined : this.trimOptional(dto.username),
      credentials:
        dto.credentials === undefined
          ? undefined
          : this.toJsonInput(dto.credentials),
      paymentTerms:
        dto.paymentTerms === undefined
          ? undefined
          : this.trimOptional(dto.paymentTerms),
      contactName:
        dto.contactName === undefined
          ? undefined
          : this.trimOptional(dto.contactName),
      contactEmail:
        dto.contactEmail === undefined
          ? undefined
          : this.trimOptional(dto.contactEmail),
      contactPhone:
        dto.contactPhone === undefined
          ? undefined
          : this.trimOptional(dto.contactPhone),
      notes: dto.notes === undefined ? undefined : this.trimOptional(dto.notes),
      isActive: dto.isActive,
    };
  }

  private toPlatformResponse(
    platform: VendorPlatformRecord,
  ): VendorPlatformResponse {
    const { credentials, ...safePlatform } = platform;
    const credentialKeys = this.getCredentialKeys(credentials);

    return {
      ...safePlatform,
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

  private handlePlatformPrismaError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A vendor platform with this name already exists for the account',
      );
    }
  }
}
