import { parseTemplate, renderTemplate } from './template.ts'
import { InputValues, PartialValues } from './types.ts'

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint, @typescript-eslint/no-explicit-any
export interface BasePromptTemplate<T extends any = string> {
    inputVariables: string[]
    template: string
    format(values: InputValues): Promise<T>
    partial(values: PartialValues): BasePromptTemplate<T>
    partialValues?: PartialValues
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint, @typescript-eslint/no-explicit-any
export function paritalPromptTemplate<T extends any = string>(
    template: BasePromptTemplate<T>,
    values: PartialValues
): BasePromptTemplate<T> {
    let oldPartialValues = template.partialValues ?? {}
    oldPartialValues = {
        ...oldPartialValues,
        ...values
    }
    return {
        ...template,
        format: async (values) => {
            return template.format({
                ...oldPartialValues,
                ...values
            })
        },
        partial(values) {
            return paritalPromptTemplate(template, {
                ...oldPartialValues,
                values
            })
        },
        partialValues: oldPartialValues
    }
}

export function createPromptTemplate(template: string): BasePromptTemplate {
    const nodes = parseTemplate(template)

    const inputVariables = nodes
        .filter((node) => node.type === 'variable')
        .map((node) => node.name)

    return {
        template,
        inputVariables,
        async format(values) {
            return renderTemplate(this.template, values)
        },
        partial(values) {
            return paritalPromptTemplate(this, values)
        },
        partialValues: undefined
    }
}
