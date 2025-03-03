import type { JSONSchema7 } from 'json-schema'

export function removeAdditionalProperties(schema: JSONSchema7): JSONSchema7 {
    const updatedSchema = { ...schema }
    if (Object.hasOwn(updatedSchema, 'additionalProperties')) {
        delete updatedSchema['additionalProperties']
    }

    if (Object.hasOwn(updatedSchema, '$schema')) {
        delete updatedSchema['$schema']
    }

    if (updatedSchema['properties']) {
        const keys = Object.keys(updatedSchema['properties'])
        removeProperties(updatedSchema['properties'], keys, 0)
    }
    return updatedSchema
}

function removeProperties(
    properties: JSONSchema7,
    keys: string[],
    index: number
): void {
    if (index >= keys.length) {
        return
    }
    const key = keys[index]
    // eslint-disable-next-line no-param-reassign
    properties[key] = removeAdditionalProperties(properties[key])
    removeProperties(properties, keys, index + 1)
}

export function isParsableJson(obj: string) {
    try {
        JSON.parse(obj)
        return true
    } catch (e) {
        return false
    }
}

export function buildRequestUrl(baseUrl: string, subPath: string) {
    const startWithSlash = subPath.startsWith('/')

    const subPathWithoutSlash = !startWithSlash ? subPath : subPath.substring(1)

    // check has v1
    if (baseUrl.endsWith('/v1')) {
        return baseUrl + '/' + subPathWithoutSlash
    } else if (baseUrl.endsWith('/v1/')) {
        return baseUrl + subPathWithoutSlash
    }

    // check has /
    if (baseUrl.endsWith('/')) {
        return baseUrl + subPathWithoutSlash
    }

    // add /v1
    return baseUrl + '/v1/' + subPathWithoutSlash
}
