// Build-time replacement for the DSH schema adapter in the Codex bundle.
// Shared tool implementations and their scientific code remain unchanged.
import Ajv from 'ajv'
const ajv = new Ajv({ allErrors: true, strict: false })
function schema(spec) {
  const { required, properties, items, ...rest } = spec
  const out = { ...rest }
  if (properties) {
    out.properties = Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, schema(value)]))
    const keys = Object.keys(properties).filter(key => properties[key].required === true)
    if (keys.length) out.required = keys
  }
  if (Array.isArray(required)) out.required = required
  if (items) out.items = schema(items)
  return out
}
export function defineTool(options) {
  const parameters = schema({ type: 'object', properties: options.parameters })
  const validate = ajv.compile(parameters)
  return { ...options, parameters, output: { ...options.output, schema: schema(options.output.schema) },
    async execute(args, exec) {
      if (!validate(args)) throw new Error(`INVALID_ARGS: ${ajv.errorsText(validate.errors)}`)
      return options.execute(args, exec)
    } }
}
