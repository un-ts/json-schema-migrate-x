import type { AnySchemaObject } from 'ajv'

import {
  DRAFT_7_SCHEMA,
  DRAFT_2019_SCHEMA,
  DRAFT_2020_SCHEMA,
} from './constants.js'
import type { SchemaVersion } from './types.js'

/**
 * Recursively evaluates a JSON schema to determine if it reduces to a constant
 * boolean value.
 *
 * An empty schema (i.e., an object with no keys) is considered to be a constant
 * true schema. If the schema has only the "not" property, the function
 * evaluates the value of "not" recursively and returns its logical negation
 * when it resolves to a boolean.
 *
 * @param schema - The JSON schema object to evaluate.
 * @returns A boolean indicating the constant result if determinable, or
 *   undefined if the schema's boolean value cannot be established.
 */
export function constantResultSchema(
  schema: AnySchemaObject,
): boolean | undefined {
  const keys = Object.keys(schema)
  if (keys.length === 0) {
    return true
  }
  if (keys.length === 1 && keys[0] === 'not') {
    const valid = constantResultSchema(schema.not as AnySchemaObject)
    if (typeof valid == 'boolean') {
      return !valid
    }
  }
}

/**
 * Returns the JSON meta-schema corresponding to the specified schema version.
 *
 * This function selects the appropriate meta-schema constant based on the
 * provided version, mapping 'draft7', 'draft2019', and 'draft2020' to their
 * respective meta-schema definitions. If an unrecognized version is provided,
 * the function returns undefined.
 *
 * @param version - The JSON Schema version (e.g., 'draft7', 'draft2019',
 *   'draft2020').
 * @returns The meta-schema constant for the specified version, or undefined if
 *   the version is not supported.
 */
export function metaSchema(version: SchemaVersion) {
  switch (version) {
    case 'draft7': {
      return DRAFT_7_SCHEMA
    }
    case 'draft2019': {
      return DRAFT_2019_SCHEMA
    }
    case 'draft2020': {
      return DRAFT_2020_SCHEMA
    }
  }
}
