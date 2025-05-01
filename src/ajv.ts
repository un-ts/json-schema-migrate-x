/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Ajv2019 } from 'ajv/dist/2019.js'
import { Ajv2020 } from 'ajv/dist/2020.js'
import type AjvCore from 'ajv/dist/core.js'
import type {
  AnySchema,
  AnySchemaObject,
  DataValidationCxt,
} from 'ajv/dist/types/index.js'

import { constantResultSchema, metaSchema } from './common.js'
import type { SchemaVersion } from './types.js'

const ajvCache: Partial<Record<'default' | 'draft2020', AjvCore.default>> = {}

/**
 * Retrieves an Ajv validator instance for a specified JSON Schema draft
 * version.
 *
 * This function returns a cached Ajv instance if available, or creates a new
 * one configured for either 'draft2019' (default) or 'draft2020'. The created
 * instance is enhanced with a custom "migrateSchema" keyword that transforms
 * JSON Schemas to be compatible with different specification drafts by
 * adjusting properties such as "id", "$schema", "constant", "enum", and various
 * numeric constraints.
 *
 * @param version - The target JSON Schema version (defaults to 'draft2019').
 * @returns An Ajv instance configured for JSON Schema validation and migration.
 * @remark The custom "migrateSchema" keyword may throw a TypeError if a schema's "id" is not a string, or an Error
 * if the "id" format is invalid for the given version during the migration process.
 */
export function getAjv(version: SchemaVersion = 'draft2019') {
  const isDraft2020 = version === 'draft2020'

  const cacheKey = isDraft2020 ? 'draft2020' : 'default'

  let ajv = ajvCache[cacheKey]

  if (ajv) {
    return ajv
  }

  ajv = new (isDraft2020 ? Ajv2020 : Ajv2019)({ allErrors: true })

  ajv.addKeyword({
    keyword: 'migrateSchema',
    schemaType: 'string',
    modifying: true,
    metaSchema: { enum: ['draft7', 'draft2019', 'draft2020'] },
    // eslint-disable-next-line sonarjs/cognitive-complexity
    validate(
      version: SchemaVersion,
      schema: AnySchema,
      _parentSchema?: AnySchemaObject,
      dataCxt?: DataValidationCxt,
    ) {
      if (typeof schema != 'object') {
        return true
      }

      if (dataCxt) {
        const { parentData, parentDataProperty } = dataCxt
        const valid = constantResultSchema(schema)
        if (typeof valid == 'boolean') {
          parentData[parentDataProperty] = valid
          return true
        }
      }

      const dsCopy = { ...schema }

      for (const key in dsCopy) {
        delete schema[key]
        switch (key) {
          case 'id': {
            const { id } = dsCopy
            if (typeof id !== 'string') {
              throw new TypeError(
                `json-schema-migrate: schema id must be string`,
              )
            }
            if ((version === 'draft2019' || isDraft2020) && id.includes('#')) {
              const [$id, $anchor, ...rest] = id.split('#')
              if (rest.length > 0) {
                throw new Error(`json-schema-migrate: invalid schema id ${id}`)
              }
              if ($id) {
                schema.$id = $id
              }
              if ($anchor && $anchor !== '/') {
                schema.$anchor = $anchor
              }
            } else {
              schema.$id = id
            }
            break
          }
          case '$schema': {
            schema.$schema = metaSchema(version)
            break
          }
          case 'constant': {
            schema.const = dsCopy.constant
            break
          }
          case 'enum': {
            if (
              Array.isArray(dsCopy.enum) &&
              dsCopy.enum.length === 1 &&
              dsCopy.constant === undefined &&
              dsCopy.const === undefined
            ) {
              schema.const = dsCopy.enum[0]
            } else {
              schema.enum = dsCopy.enum
            }
            break
          }
          case 'exclusiveMaximum': {
            migrateExclusive(schema, key, 'maximum')
            break
          }
          case 'exclusiveMinimum': {
            migrateExclusive(schema, key, 'minimum')
            break
          }
          case 'maximum': {
            if (dsCopy.exclusiveMaximum !== true) {
              schema.maximum = dsCopy.maximum
            }
            break
          }
          case 'minimum': {
            if (dsCopy.exclusiveMinimum !== true) {
              schema.minimum = dsCopy.minimum
            }
            break
          }
          case 'dependencies': {
            const deps = dsCopy.dependencies as Record<string, unknown>
            if (version === 'draft7') {
              schema.dependencies = deps
            } else {
              for (const prop in deps) {
                const kwd = Array.isArray(deps[prop])
                  ? 'dependentRequired'
                  : 'dependentSchemas'
                schema[kwd] ||= {}
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                schema[kwd][prop] = deps[prop]
              }
            }
            break
          }
          case 'items': {
            if (isDraft2020 && Array.isArray(dsCopy.items)) {
              schema.prefixItems = dsCopy.items
              if (dsCopy.additionalItems !== undefined) {
                schema.items = dsCopy.additionalItems
              }
            } else {
              schema.items = dsCopy.items
            }
            break
          }
          case 'additionalItems': {
            if (!isDraft2020) {
              schema.additionalItems = dsCopy.additionalItems
            }
            break
          }
          case '$recursiveAnchor': {
            if (isDraft2020) {
              schema.$dynamicAnchor = 'meta'
            } else {
              schema.$recursiveAnchor = dsCopy.$recursiveAnchor
            }
            break
          }
          default: {
            schema[key] = dsCopy[key]
          }
        }
      }
      return true

      function migrateExclusive(
        schema: AnySchemaObject,
        key: string,
        limit: string,
      ): void {
        if (dsCopy[key] === true) {
          schema[key] = dsCopy[limit]
        } else if (dsCopy[key] !== false && dsCopy[key] !== undefined) {
          ajv!.logger.warn(`${key} is not boolean`)
        }
      }
    },
  })

  ajvCache[cacheKey] = ajv

  return ajv
}
