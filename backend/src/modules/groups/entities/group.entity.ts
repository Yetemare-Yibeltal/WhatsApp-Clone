// backend/src/modules/groups/entities/group.entity.ts
import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsArray,
  IsNumber,
  IsInt,
  IsPositive,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
  IsNotEmpty,
  IsIn,
  IsUrl,
  ArrayMaxSize,
  ArrayMinSize,
  Matches,
  IsDate,
  IsJSON,
} from "class-validator";
import {
  Transform,
  Type,
  Expose,
  Exclude,
  plainToClass,
} from "class-transformer";
import {
  GroupRole,
  GroupPrivacy,
  GroupJoinPolicy,
} from "../../groups/dto/groups.dto";

export interface GroupMember {
  userId: string;
  role: GroupRole;
  joinedAt: Date;
  displayName?: string;
  avatarUrl?: string;
}

export interface GroupInvite {
  id: string;
  token: string;
  expiresAt: Date;
  maxUses: number;
  usedCount: number;
  createdBy: string;
  createdAt: Date;
  isOneTime: boolean;
}

export interface GroupSettings {
  allowAnyoneToJoin: boolean;
  requireApproval: boolean;
  notifyOnJoin: boolean;
  notifyOnLeave: boolean;
  enableModeration: boolean;
  enablePinning: boolean;
  enableCalls: boolean;
  maxMembers: number;
  customSettings?: Record<string, any>;
}

export class GroupEntity {
  @IsUUID()
  @Expose()
  id: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  @Expose()
  name: string;

  @IsString()
  @MaxLength(80)
  @Expose()
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Expose()
  description: string | null;

  @IsOptional()
  @IsUrl()
  @Expose()
  avatarUrl: string | null;

  @IsEnum(GroupPrivacy)
  @Expose()
  privacy: GroupPrivacy;

  @IsEnum(GroupJoinPolicy)
  @Expose()
  joinPolicy: GroupJoinPolicy;

  @IsBoolean()
  @Expose()
  isEncrypted: boolean;

  @IsUUID()
  @Expose()
  createdBy: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @Expose()
  deletedAt: Date | null;

  @IsOptional()
  @IsObject()
  @Expose()
  metadata: Record<string, any> | null;

  @IsOptional()
  @IsObject()
  @Expose()
  settings: GroupSettings | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  @Expose()
  members: GroupMember[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  @Expose()
  invites: GroupInvite[];

  @IsDate()
  @Type(() => Date)
  @Expose()
  createdAt: Date;

  @IsDate()
  @Type(() => Date)
  @Expose()
  updatedAt: Date;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  @Expose()
  creator?: any;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  @Expose()
  chat?: any;

  constructor(partial: Partial<GroupEntity> = {}) {
    Object.assign(this, partial);
  }

  getMemberCount(): number {
    return this.members?.length || 0;
  }

  getOwnerId(): string | null {
    const owner = this.members?.find((m) => m.role === GroupRole.OWNER);
    return owner?.userId || null;
  }

  getAdmins(): string[] {
    return (
      this.members
        ?.filter(
          (m) => m.role === GroupRole.ADMIN || m.role === GroupRole.OWNER,
        )
        .map((m) => m.userId) || []
    );
  }

  getMembers(): string[] {
    return this.members?.map((m) => m.userId) || [];
  }

  getMemberRole(userId: string): GroupRole | null {
    const member = this.members?.find((m) => m.userId === userId);
    return member?.role || null;
  }

  isMember(userId: string): boolean {
    return !!this.members?.find((m) => m.userId === userId);
  }

  isAdmin(userId: string): boolean {
    const role = this.getMemberRole(userId);
    return role === GroupRole.ADMIN || role === GroupRole.OWNER;
  }

  isOwner(userId: string): boolean {
    return this.getMemberRole(userId) === GroupRole.OWNER;
  }

  canManageMembers(userId: string): boolean {
    return this.isAdmin(userId);
  }

  canInvite(userId: string): boolean {
    return this.isMember(userId);
  }

  isPublic(): boolean {
    return this.privacy === GroupPrivacy.PUBLIC;
  }

  isPrivate(): boolean {
    return this.privacy === GroupPrivacy.PRIVATE;
  }

  isSecret(): boolean {
    return this.privacy === GroupPrivacy.SECRET;
  }

  isEncryptedGroup(): boolean {
    return this.isEncrypted === true;
  }

  isDeleted(): boolean {
    return !!this.deletedAt;
  }

  getInviteLink(token: string, baseUrl: string): string {
    return `${baseUrl}/invite/${token}`;
  }

  getInviteByToken(token: string): GroupInvite | null {
    return this.invites?.find((inv) => inv.token === token) || null;
  }

  getValidInvites(): GroupInvite[] {
    const now = new Date();
    return (
      this.invites?.filter((inv) => {
        if (!inv.expiresAt) return true;
        return inv.expiresAt > now && inv.usedCount < inv.maxUses;
      }) || []
    );
  }

  getExpiredInvites(): GroupInvite[] {
    const now = new Date();
    return (
      this.invites?.filter((inv) => {
        if (!inv.expiresAt) return false;
        return inv.expiresAt <= now || inv.usedCount >= inv.maxUses;
      }) || []
    );
  }

  addMember(userId: string, role: GroupRole = GroupRole.MEMBER): void {
    if (this.isMember(userId)) return;
    if (!this.members) this.members = [];
    this.members.push({
      userId,
      role,
      joinedAt: new Date(),
    });
    this.updatedAt = new Date();
  }

  removeMember(userId: string): boolean {
    if (!this.members) return false;
    const index = this.members.findIndex((m) => m.userId === userId);
    if (index === -1) return false;
    this.members.splice(index, 1);
    this.updatedAt = new Date();
    return true;
  }

  updateMemberRole(userId: string, role: GroupRole): boolean {
    const member = this.members?.find((m) => m.userId === userId);
    if (!member) return false;
    member.role = role;
    this.updatedAt = new Date();
    return true;
  }

  addInvite(invite: GroupInvite): void {
    if (!this.invites) this.invites = [];
    this.invites.push(invite);
    this.updatedAt = new Date();
  }

  removeInvite(token: string): boolean {
    if (!this.invites) return false;
    const index = this.invites.findIndex((inv) => inv.token === token);
    if (index === -1) return false;
    this.invites.splice(index, 1);
    this.updatedAt = new Date();
    return true;
  }

  updateSettings(settings: Partial<GroupSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings,
    };
    this.updatedAt = new Date();
  }

  getMaxMembers(): number {
    return this.settings?.maxMembers || 1000;
  }

  isFull(): boolean {
    return this.getMemberCount() >= this.getMaxMembers();
  }

  canJoinWithoutApproval(): boolean {
    return this.joinPolicy === GroupJoinPolicy.ANYONE;
  }

  requiresApproval(): boolean {
    return this.joinPolicy === GroupJoinPolicy.APPROVAL;
  }

  isInviteOnly(): boolean {
    return this.joinPolicy === GroupJoinPolicy.INVITE_ONLY;
  }

  toResponse(): Partial<GroupEntity> {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      avatarUrl: this.avatarUrl,
      privacy: this.privacy,
      joinPolicy: this.joinPolicy,
      isEncrypted: this.isEncrypted,
      createdBy: this.createdBy,
      metadata: this.metadata,
      settings: this.settings,
      memberCount: this.getMemberCount(),
      members: this.members,
      invites: this.getValidInvites(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      creator: this.creator,
      chat: this.chat,
    };
  }

  toPublicResponse(): Partial<GroupEntity> {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      avatarUrl: this.avatarUrl,
      privacy: this.privacy,
      isEncrypted: this.isEncrypted,
      createdBy: this.createdBy,
      memberCount: this.getMemberCount(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      creator: this.creator,
    };
  }

  toAdminResponse(): any {
    return {
      ...this.toResponse(),
      invites: this.invites,
      deletedAt: this.deletedAt,
    };
  }

  toSocketPayload(): any {
    return {
      id: this.id,
      name: this.name,
      avatarUrl: this.avatarUrl,
      privacy: this.privacy,
      isEncrypted: this.isEncrypted,
      memberCount: this.getMemberCount(),
      members:
        this.members?.map((m) => ({
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
        })) || [],
    };
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!this.name || this.name.length === 0)
      errors.push("Group name is required");
    if (this.name && this.name.length > 100)
      errors.push("Group name cannot exceed 100 characters");
    if (this.slug && this.slug.length > 80)
      errors.push("Slug cannot exceed 80 characters");
    if (this.description && this.description.length > 500)
      errors.push("Description cannot exceed 500 characters");
    if (this.privacy && !Object.values(GroupPrivacy).includes(this.privacy)) {
      errors.push("Invalid privacy setting");
    }
    if (
      this.joinPolicy &&
      !Object.values(GroupJoinPolicy).includes(this.joinPolicy)
    ) {
      errors.push("Invalid join policy");
    }
    if (
      this.members &&
      this.members.length > (this.settings?.maxMembers || 1000)
    ) {
      errors.push(
        `Member count exceeds maximum (${this.settings?.maxMembers || 1000})`,
      );
    }
    return { valid: errors.length === 0, errors };
  }

  static fromPrisma(prismaGroup: any): GroupEntity {
    const entity = new GroupEntity({
      id: prismaGroup.id,
      name: prismaGroup.name,
      slug: prismaGroup.slug,
      description: prismaGroup.description || null,
      avatarUrl: prismaGroup.avatarUrl || null,
      privacy: prismaGroup.privacy || GroupPrivacy.PUBLIC,
      joinPolicy: prismaGroup.joinPolicy || GroupJoinPolicy.ANYONE,
      isEncrypted: prismaGroup.isEncrypted || false,
      createdBy: prismaGroup.createdBy,
      deletedAt: prismaGroup.deletedAt || null,
      metadata: prismaGroup.metadata || null,
      settings: prismaGroup.settings || null,
      createdAt: prismaGroup.createdAt,
      updatedAt: prismaGroup.updatedAt,
      creator: prismaGroup.creator,
      chat: prismaGroup.chat,
    });

    if (prismaGroup.members) {
      entity.members = prismaGroup.members.map((m: any) => ({
        userId: m.userId,
        role: m.role || GroupRole.MEMBER,
        joinedAt: m.joinedAt,
        displayName: m.user?.displayName,
        avatarUrl: m.user?.profile?.avatarUrl,
      }));
    }

    if (prismaGroup.invites) {
      entity.invites = prismaGroup.invites.map((inv: any) => ({
        id: inv.id,
        token: inv.token,
        expiresAt: inv.expiresAt,
        maxUses: inv.maxUses || 1,
        usedCount: inv.usedCount || 0,
        createdBy: inv.createdBy,
        createdAt: inv.createdAt,
        isOneTime: inv.isOneTime || false,
      }));
    }

    return entity;
  }

  static createNew(
    name: string,
    createdBy: string,
    options: {
      description?: string;
      avatarUrl?: string;
      privacy?: GroupPrivacy;
      joinPolicy?: GroupJoinPolicy;
      isEncrypted?: boolean;
      metadata?: Record<string, any>;
      settings?: GroupSettings;
      memberIds?: string[];
    } = {},
  ): GroupEntity {
    const entity = new GroupEntity();
    entity.id = `group_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    entity.name = name;
    entity.slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .substring(0, 80);
    entity.description = options.description || null;
    entity.avatarUrl = options.avatarUrl || null;
    entity.privacy = options.privacy || GroupPrivacy.PUBLIC;
    entity.joinPolicy = options.joinPolicy || GroupJoinPolicy.ANYONE;
    entity.isEncrypted = options.isEncrypted || false;
    entity.createdBy = createdBy;
    entity.metadata = options.metadata || null;
    entity.settings = options.settings || {
      allowAnyoneToJoin: true,
      requireApproval: false,
      notifyOnJoin: true,
      notifyOnLeave: true,
      enableModeration: false,
      enablePinning: true,
      enableCalls: true,
      maxMembers: 1000,
      customSettings: {},
    };
    entity.members = [];
    entity.invites = [];
    entity.createdAt = new Date();
    entity.updatedAt = new Date();
    entity.deletedAt = null;

    // Add creator as owner
    if (createdBy) {
      entity.addMember(createdBy, GroupRole.OWNER);
    }

    // Add additional members
    if (options.memberIds) {
      for (const userId of options.memberIds) {
        if (userId !== createdBy) {
          entity.addMember(userId, GroupRole.MEMBER);
        }
      }
    }

    return entity;
  }

  static createTestGroup(overrides: Partial<GroupEntity> = {}): GroupEntity {
    const entity = GroupEntity.createNew("Test Group", "test-owner-123", {
      description: "A test group for development",
      privacy: GroupPrivacy.PUBLIC,
      joinPolicy: GroupJoinPolicy.ANYONE,
      memberIds: ["test-user-1", "test-user-2"],
    });
    Object.assign(entity, overrides);
    return entity;
  }

  static getDefaultSettings(): GroupSettings {
    return {
      allowAnyoneToJoin: true,
      requireApproval: false,
      notifyOnJoin: true,
      notifyOnLeave: true,
      enableModeration: false,
      enablePinning: true,
      enableCalls: true,
      maxMembers: 1000,
      customSettings: {},
    };
  }

  static getDefaultPrivacy(): GroupPrivacy {
    return GroupPrivacy.PUBLIC;
  }

  static getDefaultJoinPolicy(): GroupJoinPolicy {
    return GroupJoinPolicy.ANYONE;
  }

  static getMaxNameLength(): number {
    return 100;
  }

  static getMaxDescriptionLength(): number {
    return 500;
  }

  static getMaxMembersDefault(): number {
    return 1000;
  }

  static isValidPrivacy(privacy: string): boolean {
    return Object.values(GroupPrivacy).includes(privacy as GroupPrivacy);
  }

  static isValidJoinPolicy(policy: string): boolean {
    return Object.values(GroupJoinPolicy).includes(policy as GroupJoinPolicy);
  }

  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .substring(0, 80);
  }

  static generateInviteToken(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  static generateInviteLink(token: string, baseUrl: string): string {
    return `${baseUrl}/invite/${token}`;
  }
}
