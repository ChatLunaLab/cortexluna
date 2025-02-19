import {
    createNodeFactory,
    executeWorkflow,
    NodeContext,
    NodeDefinition,
    NodeIO,
    WorkflowNode
} from '../src/index.ts'
import { z } from 'zod'

describe('1', () => {
    it('2', async () => {
        // Example: Map-Reduce workflow with conditional branching

        // Define node types
        type MapInput = { items: unknown[] }
        type MapOutput = {
            mappedItems: Array<{ value: unknown; timestamp: number }>
        }

        const mapNode: NodeDefinition<MapInput, MapOutput> = {
            inputSchema: z.object({
                items: z.array(z.unknown())
            }),
            outputSchema: z.object({
                mappedItems: z.array(
                    z.object({
                        value: z.unknown(),
                        timestamp: z.number()
                    })
                )
            }) as z.ZodType<MapOutput>,
            run: async (input: MapInput, context: NodeContext) => {
                console.log(context.variables)
                const items = input.items
                const mappedItems = items.map((item) => ({
                    value: item,
                    timestamp: Date.now()
                }))
                return { mappedItems }
            }
        }

        type FilterInput = {
            mappedItems: Array<{ value: unknown; timestamp: number }>
        }
        type FilterOutput = {
            validItems: Array<{ value: number; timestamp: number }>
            invalidItems: Array<{ value: unknown; timestamp: number }>
        }

        const filterNode: NodeDefinition<FilterInput, FilterOutput> = {
            inputSchema: z.object({
                mappedItems: z.array(
                    z.object({
                        value: z.unknown(),
                        timestamp: z.number()
                    })
                )
            }) as z.ZodType<FilterInput>,
            outputSchema: z.object({
                validItems: z.array(
                    z.object({
                        value: z.number(),
                        timestamp: z.number()
                    })
                ),
                invalidItems: z.array(
                    z.object({
                        value: z.unknown(),
                        timestamp: z.number()
                    })
                )
            }) as z.ZodType<FilterOutput>,
            run: async (input: FilterInput) => {
                const items = input.mappedItems
                const [validItems, invalidItems] = items.reduce(
                    ([valid, invalid], item) => {
                        return typeof item.value === 'number'
                            ? [
                                  [
                                      ...valid,
                                      { ...item, value: item.value as number }
                                  ],
                                  invalid
                              ]
                            : [valid, [...invalid, item]]
                    },
                    [[], []] as [typeof validItems, typeof invalidItems]
                )
                return { validItems, invalidItems }
            }
        }

        type ValidInput = {
            validItems: Array<{ value: number; timestamp: number }>
        }
        type ValidOutput = { sum: number }

        const reduceValidNode: NodeDefinition<ValidInput, ValidOutput> = {
            inputSchema: z.object({
                validItems: z.array(
                    z.object({
                        value: z.number(),
                        timestamp: z.number()
                    })
                )
            }),
            outputSchema: z.object({
                sum: z.number()
            }),
            run: async (input: ValidInput) => {
                const items = input.validItems
                const sum = items.reduce((acc, item) => acc + item.value, 0)
                return { sum }
            }
        }

        type InvalidInput = {
            invalidItems: Array<{ value: any; timestamp: number }>
        }
        type InvalidOutput = { errorCount: number }

        const reduceInvalidNode: NodeDefinition<InvalidInput, InvalidOutput> = {
            inputSchema: z.object({
                invalidItems: z.array(
                    z.object({
                        value: z.unknown(),
                        timestamp: z.number()
                    })
                )
            }) as z.ZodType<InvalidInput>,
            outputSchema: z.object({
                errorCount: z.number()
            }),
            run: async (input: InvalidInput) => {
                const items = input.invalidItems
                return { errorCount: items.length }
            }
        }

        // Create and configure workflow
        async function runExample() {
            const factory = createNodeFactory()
            factory.registerNode('map', mapNode)
            factory.registerNode('filter', filterNode)
            factory.registerNode('reduceValid', reduceValidNode)
            factory.registerNode('reduceInvalid', reduceInvalidNode)

            const workflow: WorkflowNode[] = [
                {
                    id: 'map1',
                    type: 'map',
                    dependencies: []
                },
                {
                    id: 'filter1',
                    type: 'filter',
                    dependencies: ['map1']
                },
                {
                    id: 'reduceValid1',
                    type: 'reduceValid',
                    dependencies: ['filter1']
                },
                {
                    id: 'reduceInvalid1',
                    type: 'reduceInvalid',
                    dependencies: ['filter1']
                }
            ]

            const initialContext: NodeContext = {
                variables: {
                    items: [1, 'two', 3, 'four', 5]
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
                        onNodeStart: (nodeId) =>
                            console.log(`Starting node: ${nodeId}`),
                        onNodeComplete: (nodeId, result) =>
                            console.log(`Completed node: ${nodeId}`, result),
                        onNodeError: (nodeId, error) =>
                            console.error(`Error in node: ${nodeId}`, error),
                        onWorkflowComplete: (results) =>
                            console.log('Workflow completed:', results)
                    }
                }
            )

            return results
        }

        const results = await runExample()
        console.log(results)
    })
})
