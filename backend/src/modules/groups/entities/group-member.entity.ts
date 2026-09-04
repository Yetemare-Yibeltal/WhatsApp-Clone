// backend/src/modules/groups/entities/group-member.entity.ts
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
import { GroupRole } from "../../../common/types/socket-payload.interface";

export interface GroupMemberPermissions {
  canSendMessages: boolean;
  canSendMedia: boolean;
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canPromoteMembers: boolean;
  canDemoteMembers: boolean;
  canEditGroupInfo: boolean;
  canDeleteGroup: boolean;
  canPinMessages: boolean;
  canMuteMembers: boolean;
  canViewMemberList: boolean;
  canInviteMembers: boolean;
  canApproveJoinRequests: boolean;
}

export class GroupMemberEntity {
  @IsUUID()
  @Expose()
  id: string;

  @IsUUID()
  @Expose()
  groupId: string;

  @IsUUID()
  @Expose()
  userId: string;

  @IsEnum(GroupRole)
  @Expose()
  role: GroupRole;

  @IsBoolean()
  @Expose()
  isActive: boolean;

  @IsBoolean()
  @Expose()
  isMuted: boolean;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @Expose()
  mutedUntil: Date | null;

  @IsOptional()
  @IsBoolean()
  @Expose()
  isBanned: boolean;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @Expose()
  bannedAt: Date | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Expose()
  banReason: string | null;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @Expose()
  joinedAt: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @Expose()
  leftAt: Date | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Expose()
  leftReason: string | null;

  @IsOptional()
  @IsObject()
  @Expose()
  metadata: Record<string, any> | null;

  @IsOptional()
  @IsObject()
  @Expose()
  customPermissions: Partial<GroupMemberPermissions> | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Expose()
  messageCount: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @Expose()
  lastActivityAt: Date | null;

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
  user?: any;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  @Expose()
  group?: any;

  constructor(partial: Partial<GroupMemberEntity> = {}) {
    Object.assign(this, partial);
  }

  isOwner(): boolean {
    return this.role === GroupRole.OWNER;
  }

  isAdmin(): boolean {
    return this.role === GroupRole.ADMIN || this.role === GroupRole.OWNER;
  }

  isMember(): boolean {
    return this.role === GroupRole.MEMBER;
  }

  isActiveMember(): boolean {
    return this.isActive && !this.isBanned && !this.leftAt;
  }

  isBannedMember(): boolean {
    return this.isBanned === true;
  }

  isMutedMember(): boolean {
    if (!this.isMuted) return false;
    if (this.mutedUntil && new Date() > this.mutedUntil) {
      return false;
    }
    return true;
  }

  canSendMessages(): boolean {
    if (!this.isActiveMember()) return false;
    if (this.isMutedMember()) return false;
    if (this.customPermissions?.canSendMessages === false) return false;
    return true;
  }

  canSendMedia(): boolean {
    if (!this.isActiveMember()) return false;
    if (this.isMutedMember()) return false;
    if (this.customPermissions?.canSendMedia === false) return false;
    return this.isAdmin() || this.customPermissions?.canSendMedia !== false;
  }

  canAddMembers(): boolean {
    if (!this.isActiveMember()) return false;
    return this.isAdmin() || this.customPermissions?.canAddMembers === true;
  }

  canRemoveMembers(): boolean {
    if (!this.isActiveMember()) return false;
    return this.isAdmin() || this.customPermissions?.canRemoveMembers === true;
  }

  canPromoteMembers(): boolean {
    if (!this.isActiveMember()) return false;
    return this.isOwner() || this.customPermissions?.canPromoteMembers === true;
  }

  canDemoteMembers(): boolean {
    if (!this.isActiveMember()) return false;
    return this.isOwner() || this.customPermissions?.canDemoteMembers === true;
  }

  canEditGroupInfo(): boolean {
    if (!this.isActiveMember()) return false;
    return this.isAdmin() || this.customPermissions?.canEditGroupInfo === true;
  }

  canDeleteGroup(): boolean {
    if (!this.isActiveMember()) return false;
    return this.isOwner() || this.customPermissions?.canDeleteGroup === true;
  }

  canPinMessages(): boolean {
    if (!this.isActiveMember()) return false;
    return this.isAdmin() || this.customPermissions?.canPinMessages === true;
  }

  canMuteMembers(): boolean {
    if (!this.isActiveMember()) return false;
    return this.isAdmin() || this.customPermissions?.canMuteMembers === true;
  }

  canViewMemberList(): boolean {
    if (!this.isActiveMember()) return false;
    return true;
  }

  canInviteMembers(): boolean {
    if (!this.isActiveMember()) return false;
    return true;
  }

  canApproveJoinRequests(): boolean {
    if (!this.isActiveMember()) return false;
    return (
      this.isAdmin() || this.customPermissions?.canApproveJoinRequests === true
    );
  }

  canManageMember(member: GroupMemberEntity): boolean {
    if (!this.isActiveMember()) return false;
    if (this.isOwner()) return true;
    if (!this.isAdmin()) return false;
    if (member.isOwner()) return false;
    if (member.isAdmin() && !this.isOwner()) return false;
    return true;
  }

  getRolePriority(): number {
    const priorities: Record<GroupRole, number> = {
      [GroupRole.MEMBER]: 0,
      [GroupRole.ADMIN]: 1,
      [GroupRole.OWNER]: 2,
    };
    return priorities[this.role] || 0;
  }

  isHigherThan(member: GroupMemberEntity): boolean {
    return this.getRolePriority() > member.getRolePriority();
  }

  isEqualOrHigherThan(member: GroupMemberEntity): boolean {
    return this.getRolePriority() >= member.getRolePriority();
  }

  promote(): void {
    if (this.isOwner()) return;
    if (this.isAdmin()) {
      this.role = GroupRole.OWNER;
    } else {
      this.role = GroupRole.ADMIN;
    }
    this.updatedAt = new Date();
  }

  demote(): void {
    if (this.isOwner()) {
      this.role = GroupRole.ADMIN;
    } else if (this.isAdmin()) {
      this.role = GroupRole.MEMBER;
    }
    this.updatedAt = new Date();
  }

  mute(durationSeconds: number): void {
    this.isMuted = true;
    this.mutedUntil = new Date(Date.now() + durationSeconds * 1000);
    this.updatedAt = new Date();
  }

  unmute(): void {
    this.isMuted = false;
    this.mutedUntil = null;
    this.updatedAt = new Date();
  }

  ban(reason: string): void {
    this.isBanned = true;
    this.bannedAt = new Date();
    this.banReason = reason;
    this.isActive = false;
    this.updatedAt = new Date();
  }

  unban(): void {
    this.isBanned = false;
    this.bannedAt = null;
    this.banReason = null;
    this.isActive = true;
    this.updatedAt = new Date();
  }

  leave(reason?: string): void {
    this.leftAt = new Date();
    this.leftReason = reason || null;
    this.isActive = false;
    this.updatedAt = new Date();
  }

  join(): void {
    this.leftAt = null;
    this.leftReason = null;
    this.isActive = true;
    this.joinedAt = new Date();
    this.updatedAt = new Date();
  }

  getPermissions(): GroupMemberPermissions {
    return {
      canSendMessages: this.canSendMessages(),
      canSendMedia: this.canSendMedia(),
      canAddMembers: this.canAddMembers(),
      canRemoveMembers: this.canRemoveMembers(),
      canPromoteMembers: this.canPromoteMembers(),
      canDemoteMembers: this.canDemoteMembers(),
      canEditGroupInfo: this.canEditGroupInfo(),
      canDeleteGroup: this.canDeleteGroup(),
      canPinMessages: this.canPinMessages(),
      canMuteMembers: this.canMuteMembers(),
      canViewMemberList: this.canViewMemberList(),
      canInviteMembers: this.canInviteMembers(),
      canApproveJoinRequests: this.canApproveJoinRequests(),
    };
  }

  incrementMessageCount(): void {
    this.messageCount = (this.messageCount || 0) + 1;
    this.lastActivityAt = new Date();
    this.updatedAt = new Date();
  }

  getRoleLabel(): string {
    const labels: Record<GroupRole, string> = {
      [GroupRole.MEMBER]: "Member",
      [GroupRole.ADMIN]: "Admin",
      [GroupRole.OWNER]: "Owner",
    };
    return labels[this.role] || "Unknown";
  }

  getRoleColor(): string {
    const colors: Record<GroupRole, string> = {
      [GroupRole.MEMBER]: "#9E9E9E",
      [GroupRole.ADMIN]: "#2196F3",
      [GroupRole.OWNER]: "#4CAF50",
    };
    return colors[this.role] || "#9E9E9E";
  }

  getRoleIcon(): string {
    const icons: Record<GroupRole, string> = {
      [GroupRole.MEMBER]: "👤",
      [GroupRole.ADMIN]: "🛡️",
      [GroupRole.OWNER]: "👑",
    };
    return icons[this.role] || "👤";
  }

  getMuteRemaining(): number | null {
    if (!this.mutedUntil) return null;
    const remaining = this.mutedUntil.getTime() - Date.now();
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / 1000);
  }

  getMuteRemainingFormatted(): string | null {
    const seconds = this.getMuteRemaining();
    if (seconds === null) return null;
    if (seconds <= 0) return "Not muted";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `${hours}h`;
    }
    const days = Math.floor(seconds / 86400);
    return `${days}d`;
  }

  isMuteExpired(): boolean {
    if (!this.mutedUntil) return true;
    return new Date() > this.mutedUntil;
  }

  toResponse(): Partial<GroupMemberEntity> {
    return {
      id: this.id,
      groupId: this.groupId,
      userId: this.userId,
      role: this.role,
      roleLabel: this.getRoleLabel(),
      roleColor: this.getRoleColor(),
      roleIcon: this.getRoleIcon(),
      isActive: this.isActive,
      isMuted: this.isMuted,
      mutedUntil: this.mutedUntil,
      isBanned: this.isBanned,
      bannedAt: this.bannedAt,
      banReason: this.banReason,
      joinedAt: this.joinedAt,
      leftAt: this.leftAt,
      leftReason: this.leftReason,
      messageCount: this.messageCount,
      lastActivityAt: this.lastActivityAt,
      permissions: this.getPermissions(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      user: this.user,
    };
  }

  toAdminResponse(): any {
    return {
      ...this.toResponse(),
      metadata: this.metadata,
      customPermissions: this.customPermissions,
      group: this.group,
    };
  }

  toSocketPayload(): any {
    return {
      userId: this.userId,
      role: this.role,
      roleLabel: this.getRoleLabel(),
      roleColor: this.getRoleColor(),
      roleIcon: this.getRoleIcon(),
      isActive: this.isActive,
      isMuted: this.isMuted,
      joinedAt: this.joinedAt,
      displayName: this.user?.displayName || "Unknown",
      avatarUrl: this.user?.profile?.avatarUrl || null,
    };
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!this.groupId) errors.push("groupId is required");
    if (!this.userId) errors.push("userId is required");
    if (!this.role) errors.push("role is required");
    if (this.role && !Object.values(GroupRole).includes(this.role)) {
      errors.push("Invalid role");
    }
    if (this.isMuted && !this.mutedUntil) {
      errors.push("mutedUntil is required when isMuted is true");
    }
    if (this.isBanned && !this.banReason) {
      errors.push("banReason is required when isBanned is true");
    }
    if (this.leftAt && !this.leftReason) {
      errors.push("leftReason is required when leftAt is set");
    }
    return { valid: errors.length === 0, errors };
  }

  static fromPrisma(prismaMember: any): GroupMemberEntity {
    return new GroupMemberEntity({
      id: prismaMember.id,
      groupId: prismaMember.groupId,
      userId: prismaMember.userId,
      role: prismaMember.role || GroupRole.MEMBER,
      isActive: prismaMember.isActive !== false,
      isMuted: prismaMember.isMuted || false,
      mutedUntil: prismaMember.mutedUntil || null,
      isBanned: prismaMember.isBanned || false,
      bannedAt: prismaMember.bannedAt || null,
      banReason: prismaMember.banReason || null,
      joinedAt: prismaMember.joinedAt || new Date(),
      leftAt: prismaMember.leftAt || null,
      leftReason: prismaMember.leftReason || null,
      metadata: prismaMember.metadata || null,
      customPermissions: prismaMember.customPermissions || null,
      messageCount: prismaMember.messageCount || 0,
      lastActivityAt: prismaMember.lastActivityAt || null,
      createdAt: prismaMember.createdAt || new Date(),
      updatedAt: prismaMember.updatedAt || new Date(),
      user: prismaMember.user,
      group: prismaMember.group,
    });
  }

  static createNew(
    groupId: string,
    userId: string,
    role: GroupRole = GroupRole.MEMBER,
    options: {
      isActive?: boolean;
      isMuted?: boolean;
      mutedUntil?: Date;
      isBanned?: boolean;
      banReason?: string;
      metadata?: Record<string, any>;
      customPermissions?: Partial<GroupMemberPermissions>;
    } = {},
  ): GroupMemberEntity {
    const entity = new GroupMemberEntity();
    entity.id = `gm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    entity.groupId = groupId;
    entity.userId = userId;
    entity.role = role;
    entity.isActive = options.isActive !== false;
    entity.isMuted = options.isMuted || false;
    entity.mutedUntil = options.mutedUntil || null;
    entity.isBanned = options.isBanned || false;
    entity.banReason = options.banReason || null;
    entity.joinedAt = new Date();
    entity.leftAt = null;
    entity.leftReason = null;
    entity.metadata = options.metadata || null;
    entity.customPermissions = options.customPermissions || null;
    entity.messageCount = 0;
    entity.lastActivityAt = new Date();
    entity.createdAt = new Date();
    entity.updatedAt = new Date();
    return entity;
  }

  static createOwner(
    groupId: string,
    userId: string,
    options: { metadata?: Record<string, any> } = {},
  ): GroupMemberEntity {
    return GroupMemberEntity.createNew(groupId, userId, GroupRole.OWNER, {
      isActive: true,
      isMuted: false,
      metadata: options.metadata,
    });
  }

  static createAdmin(
    groupId: string,
    userId: string,
    options: { metadata?: Record<string, any> } = {},
  ): GroupMemberEntity {
    return GroupMemberEntity.createNew(groupId, userId, GroupRole.ADMIN, {
      isActive: true,
      isMuted: false,
      metadata: options.metadata,
    });
  }

  static createMember(
    groupId: string,
    userId: string,
    options: { metadata?: Record<string, any> } = {},
  ): GroupMemberEntity {
    return GroupMemberEntity.createNew(groupId, userId, GroupRole.MEMBER, {
      isActive: true,
      isMuted: false,
      metadata: options.metadata,
    });
  }

  static createBanned(
    groupId: string,
    userId: string,
    reason: string,
    options: { metadata?: Record<string, any> } = {},
  ): GroupMemberEntity {
    return GroupMemberEntity.createNew(groupId, userId, GroupRole.MEMBER, {
      isActive: false,
      isBanned: true,
      banReason: reason,
      metadata: options.metadata,
    });
  }

  static createMuted(
    groupId: string,
    userId: string,
    durationSeconds: number,
    options: { metadata?: Record<string, any> } = {},
  ): GroupMemberEntity {
    const mutedUntil = new Date(Date.now() + durationSeconds * 1000);
    return GroupMemberEntity.createNew(groupId, userId, GroupRole.MEMBER, {
      isActive: true,
      isMuted: true,
      mutedUntil,
      metadata: options.metadata,
    });
  }

  static createTestMember(
    overrides: Partial<GroupMemberEntity> = {},
  ): GroupMemberEntity {
    const entity = GroupMemberEntity.createMember(
      "test-group-123",
      "test-user-123",
      { metadata: { test: true } },
    );
    Object.assign(entity, overrides);
    return entity;
  }

  static createTestAdmin(
    overrides: Partial<GroupMemberEntity> = {},
  ): GroupMemberEntity {
    const entity = GroupMemberEntity.createAdmin(
      "test-group-123",
      "test-admin-123",
      { metadata: { test: true } },
    );
    Object.assign(entity, overrides);
    return entity;
  }

  static createTestOwner(
    overrides: Partial<GroupMemberEntity> = {},
  ): GroupMemberEntity {
    const entity = GroupMemberEntity.createOwner(
      "test-group-123",
      "test-owner-123",
      { metadata: { test: true } },
    );
    Object.assign(entity, overrides);
    return entity;
  }

  static getDefaultRole(): GroupRole {
    return GroupRole.MEMBER;
  }

  static getHighestRole(): GroupRole {
    return GroupRole.OWNER;
  }

  static getLowestRole(): GroupRole {
    return GroupRole.MEMBER;
  }

  static getAllRoles(): GroupRole[] {
    return Object.values(GroupRole);
  }

  static getRolePriority(role: GroupRole): number {
    const priorities: Record<GroupRole, number> = {
      [GroupRole.MEMBER]: 0,
      [GroupRole.ADMIN]: 1,
      [GroupRole.OWNER]: 2,
    };
    return priorities[role] || 0;
  }

  static isHigherRole(role1: GroupRole, role2: GroupRole): boolean {
    return this.getRolePriority(role1) > this.getRolePriority(role2);
  }

  static isEqualOrHigherRole(role1: GroupRole, role2: GroupRole): boolean {
    return this.getRolePriority(role1) >= this.getRolePriority(role2);
  }

  static getRoleLabel(role: GroupRole): string {
    const labels: Record<GroupRole, string> = {
      [GroupRole.MEMBER]: "Member",
      [GroupRole.ADMIN]: "Admin",
      [GroupRole.OWNER]: "Owner",
    };
    return labels[role] || "Unknown";
  }

  static getRoleColor(role: GroupRole): string {
    const colors: Record<GroupRole, string> = {
      [GroupRole.MEMBER]: "#9E9E9E",
      [GroupRole.ADMIN]: "#2196F3",
      [GroupRole.OWNER]: "#4CAF50",
    };
    return colors[role] || "#9E9E9E";
  }

  static getRoleIcon(role: GroupRole): string {
    const icons: Record<GroupRole, string> = {
      [GroupRole.MEMBER]: "👤",
      [GroupRole.ADMIN]: "🛡️",
      [GroupRole.OWNER]: "👑",
    };
    return icons[role] || "👤";
  }

  static getDefaultPermissions(): GroupMemberPermissions {
    return {
      canSendMessages: true,
      canSendMedia: true,
      canAddMembers: false,
      canRemoveMembers: false,
      canPromoteMembers: false,
      canDemoteMembers: false,
      canEditGroupInfo: false,
      canDeleteGroup: false,
      canPinMessages: false,
      canMuteMembers: false,
      canViewMemberList: true,
      canInviteMembers: true,
      canApproveJoinRequests: false,
    };
  }

  static getAdminPermissions(): GroupMemberPermissions {
    return {
      canSendMessages: true,
      canSendMedia: true,
      canAddMembers: true,
      canRemoveMembers: true,
      canPromoteMembers: false,
      canDemoteMembers: false,
      canEditGroupInfo: true,
      canDeleteGroup: false,
      canPinMessages: true,
      canMuteMembers: true,
      canViewMemberList: true,
      canInviteMembers: true,
      canApproveJoinRequests: true,
    };
  }

  static getOwnerPermissions(): GroupMemberPermissions {
    return {
      canSendMessages: true,
      canSendMedia: true,
      canAddMembers: true,
      canRemoveMembers: true,
      canPromoteMembers: true,
      canDemoteMembers: true,
      canEditGroupInfo: true,
      canDeleteGroup: true,
      canPinMessages: true,
      canMuteMembers: true,
      canViewMemberList: true,
      canInviteMembers: true,
      canApproveJoinRequests: true,
    };
  }

  static getPermissionsForRole(role: GroupRole): GroupMemberPermissions {
    switch (role) {
      case GroupRole.OWNER:
        return this.getOwnerPermissions();
      case GroupRole.ADMIN:
        return this.getAdminPermissions();
      default:
        return this.getDefaultPermissions();
    }
  }
}
