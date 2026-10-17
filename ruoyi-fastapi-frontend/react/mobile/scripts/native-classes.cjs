// Keep utility names available to the RN primitives. Taro's standard CSS
// transformer does not understand Tailwind v4 / grid / inherited text styles.
module.exports = ({ types: t }) => ({
  visitor: {
    Program: {
      enter(program, state) {
        if (!/[\\/]src[\\/]/.test(state.filename || "")) return;
        if (!/[\\/]primitives\.rn\.jsx$/.test(state.filename || "")) {
          for (const statement of program.get("body")) {
            if (
              statement.isImportDeclaration() &&
              statement.node.source.value === "@tarojs/components"
            )
              statement.node.source = t.stringLiteral(
                "@/components/primitives",
              );
          }
        }
        program.traverse({
          JSXAttribute(path) {
            if (t.isJSXIdentifier(path.node.name, { name: "className" }))
              path.node.name = t.jsxIdentifier("utilityClass");
          },
        });
      },
    },
  },
});
