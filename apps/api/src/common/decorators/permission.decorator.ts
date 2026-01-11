import { SetMetadata } from '@nestjs/common';
import { PermissionResource, PermissionType } from '../../schools/dto/permission.dto';

export const PERMISSION_KEY = 'permission';

/**
 * Decorator to specify required permission for a route
 * @param resource The resource area (e.g., STUDENTS, STAFF)
 * @param type The permission type (READ, WRITE, ADMIN)
 */
export const RequirePermission = (resource: PermissionResource, type: PermissionType) =>
  SetMetadata(PERMISSION_KEY, { resource, type });
