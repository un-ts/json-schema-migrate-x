import type { AnySchemaObject, SchemaObject, ValidateFunction } from 'ajv'

import { getAjv } from './ajv.js'
import { metaSchema } from './common.js'
import { DRAFT_2020_SCHEMA, DRAFT_2019_SCHEMA } from './constants.js'
import type { SchemaVersion } from './types.js'

/**
 * Generates a migration schema object based on the specified version.
 *
 * This function constructs a schema object used for validating schema
 * migrations. It selects between two draft schemas depending on whether the
 * provided version is 'draft2020' or not, and returns an object with a unique
 * `$id`, the chosen schema, and an `allOf` array that combines migration
 * metadata with a reference to the base schema. For the 'draft2020' version, a
 * `$dynamicAnchor` is added, whereas for other versions a `$recursiveAnchor`
 * property is set.
 *
 * @param version - The migration schema version (e.g., 'draft2020').
 * @returns The migration schema object configured for the supplied version.
 */
export function getMigrateSchema(version: SchemaVersion): SchemaObject {
  const isDraft2020 = version === 'draft2020'
  const schema = isDraft2020 ? DRAFT_2020_SCHEMA : DRAFT_2019_SCHEMA
  return {
    $id: `migrateSchema-${version}`,
    $schema: schema,
    allOf: [{ migrateSchema: version }, { $ref: schema }],
    ...(isDraft2020 ? { $dynamicAnchor: 'meta' } : { $recursiveAnchor: true }),
  }
}

/**
 * Returns a schema migration function for the specified version.
 *
 * The returned function validates a provided schema against a migration schema
 * and ensures its "$schema" property is set to the correct meta-schema for the
 * given version. The migration validator is compiled on the first invocation
 * and reused for subsequent validations.
 *
 * @param version - The schema version specifying which migration rules and
 *   meta-schema to use.
 * @returns A function that, when given a schema object, validates it for
 *   migration and updates its "$schema" property.
 */
export function getMigrate(version: SchemaVersion) {
  let migrate: ValidateFunction | undefined
  return (schema: AnySchemaObject) => {
    migrate ||= getAjv(version).compile(getMigrateSchema(version))
    migrate(schema)
    schema.$schema ||= metaSchema(version)
  }
}
