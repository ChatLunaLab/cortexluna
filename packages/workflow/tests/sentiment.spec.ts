import {
    createNodeFactory,
    executeWorkflow,
    NodeContext,
    NodeDefinition,
    WorkflowNode
} from '../src/index.ts'
import { z } from 'zod'
import { expect } from 'chai'
import { openaiCompatible } from '@cortexluna/openai-compatible'
import {
    bindPromptTemplate,
    bindPromptTemplateToObject,
    generatateObject,
    promptTemplate
} from 'cortexluna'

describe('Sentiment Analysis Workflow', () => {
    it('should handle single and multi-sentiment analysis paths', async function () {
        this.timeout(100000)

        // Define node types
        type StartInput = {
            input_text: string
            multisentiment: boolean
            categories?: string[]
        }

        const startNode: NodeDefinition<StartInput, Record<string, never>> = {
            inputSchema: z.object({
                input_text: z.string(),
                multisentiment: z.boolean(),
                categories: z.array(z.string()).optional()
            }),
            outputSchema: {},
            run: async (input: StartInput, context: NodeContext) => {
                context.variables = { ...context.variables, ...input }
                return {}
            }
        }

        type IfNodeInput = Record<string, unknown>
        type IfNodeOutput = Record<string, boolean>

        type VariableConfig = { name: string; type: 'input' | 'context' } | string

        const ifNode: NodeDefinition<IfNodeInput, IfNodeOutput> = {
            inputSchema: (node: WorkflowNode) => {
                const config = node.config as
                    | { expressions: Record<string, string>; variables?: VariableConfig[] }
                    | undefined
                if (!config) return z.record(z.unknown())

                const vars = new Set<string>()
                Object.values(config.expressions).forEach((expr) => {
                    extractVariables(expr).forEach((v) => vars.add(v))
                })

                const inputFields: Record<string, z.ZodType> = {}
                vars.forEach((v) => {
                    // Only add to input schema if variable is not explicitly configured or is type 'input'
                    const varConfig = config.variables?.find(
                        (vc) => (typeof vc === 'string' ? vc : vc.name) === v
                    )
                    if (!varConfig ||
                        (typeof varConfig === 'string') ||
                        varConfig.type === 'input') {
                        inputFields[v] = z.unknown()
                    }
                })
                return z.object(inputFields)
            },
            outputSchema: (node: WorkflowNode) => {
                const config = node.config as
                    | { expressions: Record<string, string> }
                    | undefined
                if (!config) return { default: z.boolean().optional() }

                const outputSchema: Record<string, z.ZodType> = {}
                Object.keys(config.expressions).forEach((key) => {
                    outputSchema[key] = z.boolean().optional()
                })
                return outputSchema
            },
            run: async (input, context, node) => {
                const config = node?.config as
                    | { expressions: Record<string, string>; variables?: VariableConfig[] }
                    | undefined
                if (!config)
                    throw new Error('If node requires config with expressions')

                const result: IfNodeOutput = {}
                const evalContext: Record<string, unknown> = { ...input }

                // Resolve variables from context if specified
                if (config.variables) {
                    config.variables.forEach((varConfig) => {
                        if (typeof varConfig === 'object' && varConfig.type === 'context') {
                            evalContext[varConfig.name] = context.variables[varConfig.name]
                        }
                    })
                }

                // Evaluate conditions in order
                for (const [key, expression] of Object.entries(
                    config.expressions
                )) {
                    if (evaluateExpression(expression, evalContext)) {
                        result[key] = true
                        return result
                    }
                }

                return result
            }
        }

        function extractVariables(expression: string): string[] {
            const vars = new Set<string>()
            // Simple variable extraction - can be enhanced for more complex expressions
            expression
                .match(/[a-zA-Z_][a-zA-Z0-9_]*/g)
                ?.forEach((v) => vars.add(v))
            return Array.from(vars)
        }

        function evaluateExpression(
            expression: string,
            context: Record<string, unknown>
        ): boolean {
            try {
                // Create a safe evaluation context
                const evalFn = new Function(
                    ...Object.keys(context),
                    `return ${expression}`
                )
                return evalFn(...Object.values(context))
            } catch (error) {
                console.error(
                    `Error evaluating expression: ${expression}`,
                    error
                )
                return false
            }
        }

        type LLMInput = Record<string, unknown>

        type LLMOutput = {
            text: string
        }

        type LLMNodeConfig = {
            prompt: string
            schema: z.ZodType
            variables: string[]
        }

        const llmNode: NodeDefinition<LLMInput, LLMOutput, LLMNodeConfig> = {
            inputSchema: z.record(z.unknown()),
            outputSchema: {
                text: z.string()
            },
            dataSchema: z.object({
                prompt: z.string(),
                schema: z.instanceof(z.ZodType),
                variables: z.array(z.string())
            }),
            run: async (input: LLMInput, context, node, data) => {
                if (!data)
                    throw new Error(
                        'LLM node requires prompt and schema configuration'
                    )

                const variables = data.variables.reduce(
                    (acc, key) => {
                        acc[key] = context.variables[key]
                        return acc
                    },
                    {} as Record<string, unknown>
                )

                const chain = bindPromptTemplateToObject(
                    promptTemplate(data.prompt)
                )
                const { object } = await chain({
                    model: openaiCompatible('gemini-2.0-flash-lite-preview'),
                    input: variables,
                    schema: data.schema
                })
                return { text: JSON.stringify(object) }
            }
        }

        const factory = createNodeFactory()
        factory.registerNode('start', startNode)
        factory.registerNode('if', ifNode)
        factory.registerNode('llm', llmNode)

        const singleSentimentSchema = z.object({
            sentiment: z.string(),
            score: z.number(),
            category: z.string(),
            keywords: z.array(z.string())
        })

        const multiSentimentSchema = z.object({
            overall_score: z.number(),
            sentiments: z.array(
                z.object({
                    category: z.string(),
                    score: z.number()
                })
            )
        })

        // Update the workflow configuration
        const workflow: WorkflowNode[] = [
            {
                id: 'start1',
                type: 'start',
                dependencies: []
            },
            {
                id: 'if1',
                type: 'if',
                dependencies: ['start1'],
                config: {
                    expressions: {
                        if1: 'multisentiment === true',
                        elseif1: 'multisentiment === false'
                    },
                    variables: [
                        { name: 'multisentiment', type: 'context' }
                    ]
                }
            },
            {
                id: 'singleSentiment1',
                type: 'llm',
                dependencies: [
                    {
                        nodeId: 'if1',
                        portId: 'elseif1',
                        inputId: 'input_text'
                    }
                ],
                data: {
                    prompt: '分析以下文本的情感倾向："{input_text}"。考虑类别：{category}。返回一个JSON对象，包含情感（正面/负面/中性）、分数（-1到1）、类别和相关关键词。',
                    schema: singleSentimentSchema,
                    variables: ['input_text', 'category']
                }
            },
            {
                id: 'multiSentiment1',
                type: 'llm',
                dependencies: [
                    {
                        nodeId: 'if1',
                        portId: 'if1',
                        inputId: 'input_text'
                    }
                ],
                data: {
                    prompt: '从多个方面分析这段文本："{input_text}"。考虑这些类别：{categories}。返回一个JSON对象，包含总体评分（-1到1）和一个数组，列出每个类别的情感评分。',
                    schema: multiSentimentSchema,
                    variables: ['input_text', 'categories']
                }
            }
        ]

        // Test single sentiment path
        const singleSentimentContext: NodeContext = {
            variables: {
                input_text: '这个产品质量非常好，使用起来很方便！',
                multisentiment: false,
                category: '产品评价'
            },
            metadata: {}
        }

        const [singleLastResult, singleResults] = await executeWorkflow(
            workflow,
            factory,
            singleSentimentContext,
            {
                callbacks: {
                    onNodeError: (nodeId, nodeType, error) =>
                        console.error(`Error in node: ${nodeId}`, error)
                }
            }
        )

        // Verify single sentiment results
        expect(singleResults.start1.state).to.equal('completed')
        expect(singleResults.if1.state).to.equal('completed')
        expect(singleResults.singleSentiment1.state).to.equal('completed')
        expect(singleResults.multiSentiment1.state).to.equal('skipped')

        console.log(1, singleLastResult)

        const singleSentimentOutput = JSON.parse(
            singleResults.singleSentiment1.output.text as any
        )
        expect(singleSentimentOutput).to.have.property('sentiment')
        expect(singleSentimentOutput).to.have.property('score')
        expect(singleSentimentOutput).to.have.property('category')
        expect(singleSentimentOutput).to.have.property('keywords')

        // Test multi sentiment path
        const multiSentimentContext: NodeContext = {
            variables: {
                input_text: '产品做工精良，但是售后服务态度很差。',
                multisentiment: true,
                categories: ['产品质量', '客户服务']
            },
            metadata: {}
        }

        const [multiLastResult, multiResults] = await executeWorkflow(
            workflow,
            factory,
            multiSentimentContext,
            {
                callbacks: {
                    onNodeError: (nodeId, nodeType, error) =>
                        console.error(`Error in node: ${nodeId}`, error)
                }
            }
        )

        // Verify multi sentiment results
        expect(multiResults.start1.state).to.equal('completed')
        expect(multiResults.if1.state).to.equal('completed')
        expect(multiResults.singleSentiment1.state).to.equal('skipped')
        expect(multiResults.multiSentiment1.state).to.equal('completed')

        const multiSentimentOutput = JSON.parse(
            multiResults.multiSentiment1.output.text as any
        )
        expect(multiSentimentOutput).to.have.property('overall_score')
        expect(multiSentimentOutput).to.have.property('sentiments')
        expect(multiSentimentOutput.sentiments).to.be.an('array')
        expect(multiSentimentOutput.sentiments).to.have.lengthOf(2)

        console.log(2, multiLastResult)
    })
})
