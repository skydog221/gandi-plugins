import * as React from "react";
import styles from "./styles.less";
import CleanProIcon from "../../assets/icon--clean-pro.svg";

// 添加类型定义
interface BlockInput {
  block: string;
  shadow?: string;
}

interface ScratchBlock {
  id: string;
  opcode: string;
  next: string | null;
  parent: string | null;
  inputs: Record<string, BlockInput>;
  topLevel: boolean;
}

type PluginSettingValueType = string | number | string[] | number[] | boolean;

const CleanPro: React.FC<PluginContext> = ({ intl, vm, workspace, registerSettings, msg }) => {
  const [showCleanHeadlessBlocksMenu, setShowCleanHeadlessBlocksMenu] = React.useState(false);
  const [showCleanUnusedVariablesMenu, setShowCleanUnusedVariablesMenu] = React.useState(false);
  const [showCleanAllMenu, setShowCleanAllMenu] = React.useState(true);
  const [showCleanWholeProjectMenu, setShowCleanWholeProjectMenu] = React.useState(false);

  React.useEffect(() => {
    const getVariableBlocksOpcodeList = () => {
      let variableBlocksOpcodeList = ["data_variable"];
      for (const key in vm.runtime) {
        if (key.startsWith("ext_") && !key.startsWith("ext_scratch3_")) {
          vm.runtime[key].getInfo().blocks.forEach((block) => {
            if (block.blockType === "reporter") {
              variableBlocksOpcodeList.push(`${vm.runtime[key].getInfo().id}_${block.opcode}`);
            }
          });
        }
      }
      return variableBlocksOpcodeList;
    };

    const cleanHeadlessBlocks = () => {
      const currentTarget = vm.editingTarget;
      const blocks = currentTarget.blocks._blocks;
      const variableBlocksOpcodeList = getVariableBlocksOpcodeList();

      window.Blockly.Events.setGroup(true);

      let hasRemovedBlocks = true;
      while (hasRemovedBlocks) {
        hasRemovedBlocks = false;
        const blockIds = Object.keys(currentTarget.blocks._blocks);
        const topBlocks = blockIds.filter((id) => !currentTarget.blocks._blocks[id].parent);

        for (const id of topBlocks) {
          const block = workspace.getBlockById(id);
          if (block) {
            if (variableBlocksOpcodeList.includes(block.type)) continue;

            const isHat = block.startHat_;
            const hasNextBlock = block.getNextBlock() !== null;

            if (!isHat || (isHat && !hasNextBlock)) {
              block.getChildren(true).forEach((child) => child.dispose(true));
              block.dispose(true);
              hasRemovedBlocks = true;
            }
          }
        }
      }

      window.Blockly.Events.setGroup(false);
    };

    const cleanUnusedVariables = () => {
      const variableBlocksOpcodeList = getVariableBlocksOpcodeList();
      workspace.getAllBlocks().forEach((block) => {
        if (variableBlocksOpcodeList.includes(block.type) && !block.parentBlock_) {
          block.dispose(true);
        }
      });
    };

    const cleanTargetHeadlessBlocks = (target) => {
      const blocks = target.blocks._blocks;
      const variableBlocksOpcodeList = getVariableBlocksOpcodeList();
      const topBlockIds = Object.keys(blocks).filter((id) => !blocks[id].parent);
      const blocksToDelete = [];

      for (const id of topBlockIds) {
        const block = blocks[id] as ScratchBlock;
        if (variableBlocksOpcodeList.includes(block.opcode)) continue;

        const isHat =
          block.topLevel && (block.opcode.startsWith("event_") || block.opcode.startsWith("control_start_as_clone"));
        const hasNextBlock = block.next !== null;

        if (!isHat || (isHat && !hasNextBlock)) {
          blocksToDelete.push(id);

          const findAllChildren = (blockId) => {
            const currentBlock = blocks[blockId] as ScratchBlock | undefined;
            if (!currentBlock) return [];

            let children = [];
            if (currentBlock.next) {
              children.push(currentBlock.next);
              children = children.concat(findAllChildren(currentBlock.next));
            }

            if (currentBlock.inputs) {
              Object.values(currentBlock.inputs).forEach((input) => {
                if ((input as BlockInput).block) {
                  children.push((input as BlockInput).block);
                  children = children.concat(findAllChildren((input as BlockInput).block));
                }
              });
            }

            return children;
          };

          blocksToDelete.push(...findAllChildren(id));
        }
      }

      blocksToDelete.forEach((id) => delete target.blocks._blocks[id]);
    };

    const cleanTargetUnusedVariables = (target) => {
      const blocks = target.blocks._blocks;
      const variableBlocksOpcodeList = getVariableBlocksOpcodeList();
      const variableBlocks = Object.values(blocks).filter((block) =>
        variableBlocksOpcodeList.includes((block as ScratchBlock).opcode),
      );

      variableBlocks.forEach((block) => {
        const scratchBlock = block as ScratchBlock;
        if (!scratchBlock.parent) {
          delete target.blocks._blocks[scratchBlock.id];
        }
      });
    };

    const cleanWholeProject = () => {
      const currentEditingTarget = vm.editingTarget;

      try {
        window.Blockly.Events.setGroup(true);
        vm.runtime.targets.forEach((target) => {
          cleanTargetHeadlessBlocks(target);
          cleanTargetUnusedVariables(target);
        });
        window.Blockly.Events.setGroup(false);
        vm.emitWorkspaceUpdate();
        vm.setEditingTarget(currentEditingTarget.id);
      } catch (error) {
        console.error("清理工程时出错:", error);
        vm.setEditingTarget(currentEditingTarget.id);
      }
    };

    const menuItemId = window.Blockly.ContextMenu.addDynamicMenuItem(
      (items, target) => {
        if (showCleanHeadlessBlocksMenu) {
          items.splice(4, 0, {
            id: "cleanPro",
            text: msg("plugins.cleanPro.cleanHeadlessBlocks"),
            enabled: true,
            callback: cleanHeadlessBlocks,
          });
        }

        if (showCleanUnusedVariablesMenu) {
          items.splice(showCleanHeadlessBlocksMenu ? 5 : 4, 0, {
            id: "cleanUnusedVars",
            text: msg("plugins.cleanPro.cleanUnusedVariables"),
            enabled: true,
            callback: cleanUnusedVariables,
          });
        }

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

        if (showCleanWholeProjectMenu) {
          items.splice(
            (showCleanHeadlessBlocksMenu ? 1 : 0) +
              (showCleanUnusedVariablesMenu ? 1 : 0) +
              (showCleanAllMenu ? 1 : 0) +
              4,
            0,
            {
              id: "cleanWholeProject",
              text: msg("plugins.cleanPro.cleanWholeProject"),
              enabled: true,
              callback: cleanWholeProject,
            },
          );
        }

        return items;
      },
      { targetNames: ["workspace"] },
    );

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
                onFocus: (e) => e.target.blur(),
              },
              value: " ",
              description: msg("plugins.cleanPro.docs"),
              onChange: () => {},
            },
            {
              key: "showCleanHeadlessBlocksMenu",
              label: msg("plugins.cleanPro.showCleanHeadlessBlocksMenu"),
              type: "switch",
              value: showCleanHeadlessBlocksMenu,
              description: msg("plugins.cleanPro.showCleanHeadlessBlocksMenuDesc"),
              onChange: (value: PluginSettingValueType) => setShowCleanHeadlessBlocksMenu(value as boolean),
            },
            {
              key: "showCleanUnusedVariablesMenu",
              label: msg("plugins.cleanPro.showCleanUnusedVariablesMenu"),
              type: "switch",
              value: showCleanUnusedVariablesMenu,
              description: msg("plugins.cleanPro.showCleanUnusedVariablesMenuDesc"),
              onChange: (value: PluginSettingValueType) => setShowCleanUnusedVariablesMenu(value as boolean),
            },
            {
              key: "showCleanAllMenu",
              label: msg("plugins.cleanPro.showCleanAllMenu"),
              type: "switch",
              value: showCleanAllMenu,
              description: msg("plugins.cleanPro.showCleanAllMenuDesc"),
              onChange: (value: PluginSettingValueType) => setShowCleanAllMenu(value as boolean),
            },
            {
              key: "showCleanWholeProjectMenu",
              label: msg("plugins.cleanPro.showCleanWholeProjectMenu"),
              type: "switch",
              value: showCleanWholeProjectMenu,
              description: msg("plugins.cleanPro.showCleanWholeProjectMenuDesc"),
              onChange: (value: PluginSettingValueType) => setShowCleanWholeProjectMenu(value as boolean),
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
    showCleanWholeProjectMenu,
  ]);

  return <React.Fragment>{"Clean Pro Plugin"}</React.Fragment>;
};

CleanPro.displayName = "CleanPro";

export default CleanPro;
