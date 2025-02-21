import {
    createNodeFactory,
    executeWorkflow,
    NodeContext,
    NodeDefinition,
    NodeIO,
    WorkflowNode
} from '../src/index.ts'
import { z } from 'zod'
import { expect } from 'chai'

describe('Workflow with Optional Outputs and Skipped Nodes', () => {
    it('should handle optional outputs and skip nodes with missing inputs', async () => {
        // Define node types
        type ProcessorInput = { value: number }
        type ProcessorOutput = {
            even?: number
            odd?: number
        }

        const processorNode: NodeDefinition<ProcessorInput, ProcessorOutput> = {
            inputSchema: z.object({
                value: z.number()
            }),
            outputSchema: {
                even: z.number(),
                odd: z.number()
            },
            run: async (input: ProcessorInput) => {
                const result: ProcessorOutput = {}
                if (input.value % 2 === 0) {
                    result.even = input.value
                } else {
                    result.odd = input.value
                }
                return result
            }
        }

        type EvenHandlerInput = { even: number }
        type EvenHandlerOutput = { doubled: number }

        const evenHandlerNode: NodeDefinition<
            EvenHandlerInput,
            EvenHandlerOutput
        > = {
            inputSchema: z.object({
                even: z.number()
            }),
            outputSchema: {
                doubled: z.number()
            },
            run: async (input: EvenHandlerInput) => {
                return { doubled: input.even * 2 }
            }
        }

        type OddHandlerInput = { odd: number }
        type OddHandlerOutput = { tripled: number }

        const oddHandlerNode: NodeDefinition<
            OddHandlerInput,
            OddHandlerOutput
        > = {
            inputSchema: z.object({
                odd: z.number()
            }),
            outputSchema: {
                tripled: z.number()
            },
            run: async (input: OddHandlerInput) => {
                return { tripled: input.odd * 3 }
            }
        }

        // Create and configure workflow
        async function runExample() {
            const factory = createNodeFactory()
            factory.registerNode('processor', processorNode)
            factory.registerNode('evenHandler', evenHandlerNode)
            factory.registerNode('oddHandler', oddHandlerNode)

            const workflow: WorkflowNode[] = [
                {
                    id: 'processor1',
                    type: 'processor',
                    dependencies: []
                },
                {
                    id: 'evenHandler1',
                    type: 'evenHandler',
                    dependencies: [
                        {
                            nodeId: 'processor1',
                            portId: 'even',
                            inputId: 'even'
                        }
                    ]
                },
                {
                    id: 'oddHandler1',
                    type: 'oddHandler',
                    dependencies: [
                        {
                            nodeId: 'processor1',
                            portId: 'odd',
                            inputId: 'odd'
                        }
                    ]
                }
            ]

            const initialContext: NodeContext = {
                variables: {
                    value: 4 // Even number will cause oddHandler to be skipped
                },
                metadata: {}
            }

            const results = await executeWorkflow(
                workflow,
                factory,
                initialContext,
                {
                    maxRetries: 2,
                    maxParallel: 2,
                    callbacks: {
                        /*  onNodeStart: (nodeId) =>
                            console.log(`Starting node: ${nodeId}`),
                        onNodeComplete: (nodeId, result) =>
                            console.log(`Completed node: ${nodeId}`, result),
                        onNodeError: (nodeId, error) =>
                            console.error(`Error in node: ${nodeId}`, error),
                        onNodeSkipped: (nodeId) =>
                            console.log(`Skipped node: ${nodeId}`),
                        onWorkflowComplete: (results) =>
                            console.log('Workflow completed:', results) */
                    }
                }
            )

            return results
        }

        const [lastNodeResult, allResults] = await runExample()

        // Verify last node result (evenHandler1)
        expect(lastNodeResult.state).to.equal('completed')
        expect(lastNodeResult.output).to.deep.equal({ doubled: 8 })

        // Verify all node results
        expect(allResults).to.have.all.keys(
            'processor1',
            'evenHandler1',
            'oddHandler1'
        )
        expect(allResults.processor1.state).to.equal('completed')
        expect(allResults.processor1.output).to.deep.equal({ even: 4 })
        expect(allResults.evenHandler1.state).to.equal('completed')
        expect(allResults.evenHandler1.output).to.deep.equal({ doubled: 8 })
        expect(allResults.oddHandler1.state).to.equal('skipped')
        expect(allResults.oddHandler1.output).to.deep.equal({})
    })

    it('should handle conditional branching with if-node', async () => {
        // Define node types
        type IfNodeInput = { value: number }
        type IfNodeOutput = {
            true?: number
            false?: number
        }

        const ifNode: NodeDefinition<IfNodeInput, IfNodeOutput> = {
            inputSchema: z.object({
                value: z.number()
            }),
            outputSchema: {
                true: z.number().optional(),
                false: z.number().optional()
            },
            run: async (input: IfNodeInput) => {
                const result: IfNodeOutput = {}
                if (input.value > 0) {
                    result.true = input.value
                } else {
                    result.false = input.value
                }
                return result
            }
        }

        type TrueHandlerInput = { value: number }
        type TrueHandlerOutput = { doubled: number }

        const trueHandlerNode: NodeDefinition<
            TrueHandlerInput,
            TrueHandlerOutput
        > = {
            inputSchema: z.object({
                value: z.number()
            }),
            outputSchema: {
                doubled: z.number()
            },
            run: async (input: TrueHandlerInput) => {
                console.log(1, input)
                return { doubled: input.value * 2 }
            }
        }

        type FalseHandlerInput = { value: number }
        type FalseHandlerOutput = { negated: number }

        const falseHandlerNode: NodeDefinition<
            FalseHandlerInput,
            FalseHandlerOutput
        > = {
            inputSchema: z.object({
                value: z.number()
            }),
            outputSchema: {
                negated: z.number()
            },
            run: async (input: FalseHandlerInput) => {
                return { negated: -input.value }
            }
        }

        // Create and configure workflow
        const factory = createNodeFactory()
        factory.registerNode('if', ifNode)
        factory.registerNode('trueHandler', trueHandlerNode)
        factory.registerNode('falseHandler', falseHandlerNode)

        const workflow: WorkflowNode[] = [
            {
                id: 'if1',
                type: 'if',
                dependencies: []
            },
            {
                id: 'trueHandler1',
                type: 'trueHandler',
                dependencies: [
                    {
                        nodeId: 'if1',
                        portId: 'true',
                        inputId: 'value'
                    }
                ]
            },
            {
                id: 'falseHandler1',
                type: 'falseHandler',
                dependencies: [
                    {
                        nodeId: 'if1',
                        portId: 'false',
                        inputId: 'value'
                    }
                ]
            }
        ]

        const initialContext: NodeContext = {
            variables: {
                value: 5 // Positive number will trigger true branch
            },
            metadata: {}
        }

        const [lastNodeResult, allResults] = await executeWorkflow(
            workflow,
            factory,
            initialContext,
            {
                maxRetries: 2,
                maxParallel: 2,
                callbacks: {
                    onNodeError: (nodeId, nodeType, error) =>
                        console.error(`Error in node: ${nodeId}`, error)
                }
            }
        )

        // Verify last node result (trueHandler1)
        expect(lastNodeResult.state).to.equal('completed')
        expect(lastNodeResult.output).to.deep.equal({ doubled: 10 })

        // Verify all node results
        expect(allResults).to.have.all.keys(
            'if1',
            'trueHandler1',
            'falseHandler1'
        )
        expect(allResults.if1.state).to.equal('completed')
        expect(allResults.if1.output).to.deep.equal({ true: 5 })
        expect(allResults.trueHandler1.state).to.equal('completed')
        expect(allResults.trueHandler1.output).to.deep.equal({ doubled: 10 })
        expect(allResults.falseHandler1.state).to.equal('skipped')
        expect(allResults.falseHandler1.output).to.deep.equal({})
    })

    it('should handle node with custom data configuration', async () => {
        // Define node types with custom data
        type CalculatorInput = { value: number }
        type CalculatorOutput = { result: number }
        type CalculatorData = {
            operation: 'multiply' | 'divide'
            factor: number
        }

        const calculatorNode: NodeDefinition<
            CalculatorInput,
            CalculatorOutput,
            CalculatorData
        > = {
            inputSchema: z.object({
                value: z.number()
            }),
            outputSchema: {
                result: z.number()
            },
            dataSchema: z.object({
                operation: z.enum(['multiply', 'divide']),
                factor: z.number()
            }),
            run: async (input, context, node, data?: CalculatorData) => {
                if (!data) {
                    throw new Error('Missing data for calculator node')
                }
                const result =
                    data.operation === 'multiply'
                        ? input.value * data.factor
                        : input.value / data.factor
                return { result }
            }
        }

        // Create and configure workflow
        const factory = createNodeFactory()
        factory.registerNode('calculator', calculatorNode)

        const workflow: WorkflowNode[] = [
            {
                id: 'multiply',
                type: 'calculator',
                dependencies: [],
                data: {
                    operation: 'multiply',
                    factor: 2
                }
            },
            {
                id: 'divide',
                type: 'calculator',
                dependencies: [
                    {
                        nodeId: 'multiply',
                        portId: 'result',
                        inputId: 'value'
                    }
                ],
                data: {
                    operation: 'divide',
                    factor: 4
                }
            }
        ]

        const initialContext: NodeContext = {
            variables: {
                value: 10
            },
            metadata: {}
        }

        const [lastNodeResult, allResults] = await executeWorkflow(
            workflow,
            factory,
            initialContext,
            {
                maxRetries: 2,
                maxParallel: 2,
                callbacks: {
                    onNodeError: (nodeId, nodeType, error) =>
                        console.error(`Error in node: ${nodeId}`, error)
                }
            }
        )

        // Verify last node result (divide)
        expect(lastNodeResult.state).to.equal('completed')
        expect(lastNodeResult.output).to.deep.equal({ result: 5 })

        // Verify all node results
        expect(allResults).to.have.all.keys('multiply', 'divide')
        expect(allResults.multiply.state).to.equal('completed')
        expect(allResults.multiply.output).to.deep.equal({ result: 20 })
        expect(allResults.divide.state).to.equal('completed')
        expect(allResults.divide.output).to.deep.equal({ result: 5 })
    })

    it('should handle dynamic input/output schemas based on node config', async () => {
        // Define node types with dynamic schemas
        type EvalInput = { value: number | string }
        type EvalOutput = { result: unknown }

        const evalNode: NodeDefinition<EvalInput, EvalOutput> = {
            inputSchema: (node: WorkflowNode) => {
                // Dynamic input schema based on node config
                const inputType = node.config?.inputType || 'number'
                return z.object({
                    value: inputType === 'string' ? z.string() : z.number()
                })
            },
            outputSchema: (node: WorkflowNode) => {
                // Dynamic output schema based on node config
                const outputType = node.config?.outputType || 'number'
                return {
                    result: outputType === 'string' ? z.string() : z.number()
                }
            },
            run: async (input: EvalInput) => {
                // Simple evaluation for demonstration
                const result = input.value.toString()
                return { result }
            }
        }

        // Create and configure workflow
        const factory = createNodeFactory()
        factory.registerNode('eval', evalNode)

        const workflow: WorkflowNode[] = [
            {
                id: 'eval1',
                type: 'eval',
                dependencies: [],
                config: {
                    inputType: 'number',
                    outputType: 'string'
                }
            }
        ]

        const initialContext: NodeContext = {
            variables: {
                value: 42
            },
            metadata: {}
        }

        const [lastNodeResult, allResults] = await executeWorkflow(
            workflow,
            factory,
            initialContext,
            {
                maxRetries: 2,
                maxParallel: 2
            }
        )

        // Verify results
        expect(lastNodeResult.state).to.equal('completed')
        expect(lastNodeResult.output).to.deep.equal({ result: '42' })
        expect(allResults.eval1.state).to.equal('completed')
        expect(allResults.eval1.output).to.deep.equal({ result: '42' })

        // Test with invalid input type
        const invalidWorkflow: WorkflowNode[] = [
            {
                id: 'eval2',
                type: 'eval',
                dependencies: [],
                config: {
                    inputType: 'string',
                    outputType: 'number'
                }
            }
        ]

        const [invalidLastResult, invalidResults] = await executeWorkflow(
            invalidWorkflow,
            factory,
            initialContext,
            {
                maxRetries: 2,
                maxParallel: 2
            }
        )

        // Verify validation failure
        expect(invalidLastResult.state).to.equal('failed')
        expect(invalidResults.eval2.state).to.equal('failed')
    })
})
