import { expect } from 'chai'
import { serializeWorkflow, deserializeWorkflow } from '../src/file.ts'
import { WorkflowNode } from '../src/types.ts'

describe('Workflow Serialization', () => {
    it('should correctly serialize and deserialize a simple workflow', () => {
        const workflow: WorkflowNode[] = [
            {
                id: 'node1',
                type: 'processor',
                dependencies: []
            },
            {
                id: 'node2',
                type: 'handler',
                dependencies: ['node1']
            }
        ]

        const serialized = serializeWorkflow(workflow)
        const deserialized = deserializeWorkflow(serialized)

        expect(deserialized).to.deep.equal(workflow)
    })

    it('should handle complex workflow with config and data', () => {
        const workflow: WorkflowNode[] = [
            {
                id: 'start',
                type: 'input',
                dependencies: [],
                config: {
                    inputType: 'text',
                    required: true
                },
                data: {
                    defaultValue: 'test'
                }
            },
            {
                id: 'process',
                type: 'transformer',
                dependencies: [
                    {
                        nodeId: 'start',
                        portId: 'output',
                        inputId: 'value'
                    }
                ],
                config: {
                    operation: 'uppercase'
                }
            }
        ]

        const serialized = serializeWorkflow(workflow)
        const deserialized = deserializeWorkflow(serialized)

        expect(deserialized).to.deep.equal(workflow)
    })

    it('should throw error for invalid workflow structure', () => {
        const invalidWorkflow = [
            {
                // Missing required 'id' field
                type: 'processor',
                dependencies: []
            }
        ]

        expect(() => serializeWorkflow(invalidWorkflow as any)).to.throw()
    })

    it('should throw error for invalid JSON during deserialization', () => {
        const invalidJson = 'invalid json string'
        expect(() => deserializeWorkflow(invalidJson)).to.throw()
    })

    it('should preserve complex dependency structures', () => {
        const workflow: WorkflowNode[] = [
            {
                id: 'input1',
                type: 'input',
                dependencies: []
            },
            {
                id: 'input2',
                type: 'input',
                dependencies: []
            },
            {
                id: 'processor',
                type: 'combine',
                dependencies: [
                    {
                        nodeId: 'input1',
                        portId: 'value',
                        inputId: 'first'
                    },
                    {
                        nodeId: 'input2',
                        portId: 'value',
                        inputId: 'second'
                    }
                ]
            }
        ]

        const serialized = serializeWorkflow(workflow)
        const deserialized = deserializeWorkflow(serialized)

        expect(deserialized).to.deep.equal(workflow)
        expect(deserialized[2].dependencies).to.have.lengthOf(2)
        expect(deserialized[2].dependencies[0]).to.have.property('inputId', 'first')
        expect(deserialized[2].dependencies[1]).to.have.property('inputId', 'second')
    })
})