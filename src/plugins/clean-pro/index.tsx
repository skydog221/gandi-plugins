import * as React from "react";
import styles from "./styles.less";
import CleanProIcon from "../../assets/icon--clean-pro.svg";
const CleanPro: React.FC<PluginContext> = ({ intl, vm, workspace, registerSettings, msg }) => {
  const [showCleanHeadlessBlocksMenu, setShowCleanHeadlessBlocksMenu] = React.useState(false);
  const [showCleanUnusedVariablesMenu, setShowCleanUnusedVariablesMenu] = React.useState(false);
  const [showCleanAllMenu, setShowCleanAllMenu] = React.useState(true);

  React.useEffect(() => {
    const menuItemId = window.Blockly.ContextMenu.addDynamicMenuItem(
      (items, target) => {
        // 当设置启用时，添加"删除未使用的积木"菜单项
        if (showCleanHeadlessBlocksMenu) {
          items.splice(4, 0, {
            id: "cleanPro",
            text: msg("plugins.cleanPro.cleanHeadlessBlocks"),
            enabled: true,
            callback: () => {
              cleanHeadlessBlocks();
            },
          });
        }

        // 当设置启用时，添加删除未使用变量的菜单项
        if (showCleanUnusedVariablesMenu) {
          items.splice(showCleanHeadlessBlocksMenu ? 5 : 4, 0, {
            id: "cleanUnusedVars",
            text: msg("plugins.cleanPro.cleanUnusedVariables"),
            enabled: true,
            callback: () => {
              cleanUnusedVariables();
            },
          });
        }

        // 当设置启用时，添加删除未使用积木和变量的菜单项
        if (showCleanAllMenu) {
          items.splice((showCleanHeadlessBlocksMenu ? 1 : 0) + (showCleanUnusedVariablesMenu ? 1 : 0) + 4, 0, {
            id: "cleanAll",
            text: msg("plugins.cleanPro.cleanAll"),
            enabled: true,
            callback: () => {
              cleanHeadlessBlocks();
              cleanUnusedVariables();
            },
          });
        }

        return items;
      },
      {
        targetNames: ["workspace"],
      },
    );

    const cleanHeadlessBlocks = () => {
      const currentTarget = vm.editingTarget;
      const blocks = currentTarget.blocks._blocks;

      // 获取变量积木的类型列表，只用于识别顶层变量积木
      const variableBlocksOpcodeList = getVariableBlocksOpcodeList();

      window.Blockly.Events.setGroup(true);

      // 使用循环直到没有更多块可以删除
      let hasRemovedBlocks = true;
      while (hasRemovedBlocks) {
        hasRemovedBlocks = false;

        // 获取当前的块列表
        const blockIds = Object.keys(currentTarget.blocks._blocks);

        // 找出所有顶级块（没有父块的块）
        const topBlocks = blockIds.filter((id) => {
          const block = currentTarget.blocks._blocks[id];
          return !block.parent;
        });

        // 遍历所有顶级块
        for (const id of topBlocks) {
          const block = workspace.getBlockById(id);
          if (block) {
            // 如果是顶层变量积木，跳过（不删除顶层变量积木）
            if (variableBlocksOpcodeList.includes(block.type)) {
              continue;
            }

            const isHat = block.startHat_;
            const hasNextBlock = block.getNextBlock() !== null;

            if (!isHat || (isHat && !hasNextBlock)) {
              // 删除拼在他下面的blocks（包括其中的变量积木）
              block.getChildren(true).forEach((child) => {
                child.dispose(true);
              });
              block.dispose(true);
              hasRemovedBlocks = true;
            }
          }
        }
      }

      window.Blockly.Events.setGroup(false);
    };

    const getVariableBlocksOpcodeList = () => {
      // 原版变量
      let variableBlocksOpcodeList = ["data_variable"];
      for (const key in vm.runtime) {
        if (key.startsWith("ext_")) {
          if (!key.startsWith("ext_scratch3_")) {
            vm.runtime[key].getInfo().blocks.forEach((block) => {
              if (block.blockType === "reporter") {
                variableBlocksOpcodeList.push(`${vm.runtime[key].getInfo().id}_${block.opcode}`);
              }
            });
          }
        }
      }
      return variableBlocksOpcodeList;
    };
    // 删除不在积木内的变量
    const cleanUnusedVariables = () => {
      const variableBlocksOpcodeList = getVariableBlocksOpcodeList();
      workspace.getAllBlocks().forEach((block) => {
        if (variableBlocksOpcodeList.includes(block.type)) {
          // 判断是否被嵌入（是否有parentBlock）
          if (!block.parentBlock_) {
            block.dispose(true);
          }
        }
      });
    };

    const register = registerSettings(
      msg("plugins.cleanPro.title"),
      "plugin-clean-pro",
      [
        {
          key: "cleanPro",
          label: msg("plugins.cleanPro.title"),

          items: [
            {
              key: "docs",
              label: msg("plugins.cleanPro.docs.title"),
              type: "input",
              inputProps: {
                type: "input",
                onFocus: (e) => {
                  e.target.blur();
                },
              },
              value: " ",
              description: msg("plugins.cleanPro.docs"),
              onChange: (value: boolean) => {},
            },
            {
              key: "showCleanHeadlessBlocksMenu",
              label: msg("plugins.cleanPro.showCleanHeadlessBlocksMenu"),
              type: "switch",
              value: showCleanHeadlessBlocksMenu,
              description: msg("plugins.cleanPro.showCleanHeadlessBlocksMenuDesc"),
              onChange: (value: boolean) => {
                setShowCleanHeadlessBlocksMenu(value);
              },
            },
            {
              key: "showCleanUnusedVariablesMenu",
              label: msg("plugins.cleanPro.showCleanUnusedVariablesMenu"),
              type: "switch",
              value: showCleanUnusedVariablesMenu,
              description: msg("plugins.cleanPro.showCleanUnusedVariablesMenuDesc"),
              onChange: (value: boolean) => {
                setShowCleanUnusedVariablesMenu(value);
              },
            },
            {
              key: "showCleanAllMenu",
              label: msg("plugins.cleanPro.showCleanAllMenu"),
              type: "switch",
              value: showCleanAllMenu,
              description: msg("plugins.cleanPro.showCleanAllMenuDesc"),
              onChange: (value: boolean) => {
                setShowCleanAllMenu(value);
              },
            },
          ],
        },
      ],
      <CleanProIcon />,
    );

    return () => {
      window.Blockly.ContextMenu.deleteDynamicMenuItem(menuItemId);
      register.dispose();
    };
  }, [
    vm,
    workspace,
    msg,
    registerSettings,
    showCleanHeadlessBlocksMenu,
    showCleanUnusedVariablesMenu,
    showCleanAllMenu,
  ]);

  return <React.Fragment>{"Clean Pro Plugin"}</React.Fragment>;
};

CleanPro.displayName = "CleanPro";

export default CleanPro;
