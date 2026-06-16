// Barrel file — ensures NestJS build compiles all migration files.
// Imported by AppModule for side-effect (compilation inclusion only).
import './1718200000000-InitialSchema.js';
import './1718300000000-UpdateRolesEnum.js';
import './1718400000000-UpdateCarRequests.js';
import './1718500000000-AddPipelineFields.js';
import './1718600000000-AddMetadataToSettingOptions.js';
import './1718700000000-Plan08Changes.js';
import './1718800000000-AddEmailTables.js';
