import { generatateText } from '../generate/index.ts'
import { parseTemplate, renderTemplate } from './template.ts'
import { InputValues, PartialValues } from './types.ts'
import {
    BaseMessagePromptTemplate,
    BaseMessagesPromptTemplate
} from './message.ts'
import { generatateObject } from '../generate/generate-object.ts'

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

export function promptTemplate(template: string): BasePromptTemplate {
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

export function bindPromptTemplate<
    T extends typeof generatateText | typeof generatateObject
>(
    template:
        | BasePromptTemplate
        | BaseMessagePromptTemplate
        | BaseMessagesPromptTemplate,
    runFunction: T = generatateText as T
) {
    return async (
        args: Omit<Parameters<T>[0], 'prompt'> & {
            input: InputValues
        }
    ) => {
        let prompt = await template.format(args.input)

        if (typeof prompt === 'string') {
            prompt = [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        } else if (!Array.isArray(prompt)) {
            prompt = [prompt]
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await runFunction({ ...args, prompt } as any)
    }
}
