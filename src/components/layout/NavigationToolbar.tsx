'use client'

import React from 'react'
import {
  Plus,
  Download,
  FileText,
  Settings,
  Share,
  Edit,
  Trash2,
  Import,
  Save
} from 'lucide-react'

// ButtonConfig 类型定义
export interface ButtonConfig {
  text: string;
  onClick: () => void;
  icon?: React.ReactNode; // 可选的图标，支持 ReactNode
  active?: boolean; // 是否激活状态
  highlight?: boolean; // 是否高亮显示（使用深色）
  position?: 'left' | 'center' | 'right'; // 按钮位置，用于特殊布局
  className?: string; // 添加自定义类名
  id?: string; // 按钮标识，用于自定义预设模式下过滤按钮
}

// 图标映射函数 - 根据按钮文字返回对应的图标
const getIconForButton = (text: string, customIcon?: React.ReactNode): React.ReactNode => {
  // 如果已经提供了自定义图标，优先使用
  if (customIcon) return customIcon;

  // 根据按钮文字映射图标
  const iconMap: Record<string, React.ReactNode> = {
    '新建方案': <Plus className="w-4 h-4" />,
    '导入方案': <Download className="w-4 h-4" />,
    '添加咖啡豆': <Plus className="w-4 h-4" />,
    '导入咖啡豆': <Download className="w-4 h-4" />,
    '添加笔记': <Plus className="w-4 h-4" />,
    '通用方案': <FileText className="w-4 h-4" />,
    '自定义方案': <Settings className="w-4 h-4" />,
    '分享': <Share className="w-4 h-4" />,
    '编辑': <Edit className="w-4 h-4" />,
    '删除': <Trash2 className="w-4 h-4" />,
    '导入': <Import className="w-4 h-4" />,
    '保存': <Save className="w-4 h-4" />,
    // 添加更多可能的按钮文字映射
    '导出为文件': <Download className="w-4 h-4" />,
    '复制到剪贴板': <Share className="w-4 h-4" />,
    '导出中...': <Download className="w-4 h-4" />,
    '复制中...': <Share className="w-4 h-4" />,
    '保存笔记': <Save className="w-4 h-4" />,
  };

  return iconMap[text] || null;
}

interface NavigationToolbarProps {
  buttons: ButtonConfig[] | ButtonConfig[][]
  customPresetMode?: boolean
}

/**
 * 导航栏工具栏组件
 *
 * 用于在顶部导航栏右侧显示操作按钮
 * 采用极简设计，只显示最重要的操作
 */
const NavigationToolbar: React.FC<NavigationToolbarProps> = ({
  buttons,
  customPresetMode = false
}) => {
  // 判断是否是按钮组数组
  const isGroupedButtons = Array.isArray(buttons[0]) && Array.isArray(buttons)

  // 如果是自定义预设模式，过滤掉【通用方案】和【自定义方案】按钮
  const processButtons = (btns: ButtonConfig[] | ButtonConfig[][]) => {
    if (!customPresetMode) return btns

    if (isGroupedButtons) {
      // 按钮组数组
      return (btns as ButtonConfig[][]).map(group =>
        group.filter(btn =>
          btn.id === 'new' || btn.id === 'import' ||
          (!btn.id && (btn.text === '新建方案' || btn.text === '导入方案'))
        )
      ).filter(group => group.length > 0)
    } else {
      // 单个按钮数组
      return (btns as ButtonConfig[]).filter(btn =>
        btn.id === 'new' || btn.id === 'import' ||
        (!btn.id && (btn.text === '新建方案' || btn.text === '导入方案'))
      )
    }
  }

  const processedButtons = processButtons(buttons)

  // 如果没有按钮，不渲染
  if (!processedButtons || (Array.isArray(processedButtons) && processedButtons.length === 0)) {
    return null
  }

  // 极简模式：只显示最多2个最重要的按钮
  const getSimplifiedButtons = (btns: ButtonConfig[] | ButtonConfig[][]) => {
    if (isGroupedButtons) {
      const flatButtons = (btns as ButtonConfig[][]).flat()
      return flatButtons.slice(0, 2) // 只取前2个按钮
    } else {
      return (btns as ButtonConfig[]).slice(0, 2) // 只取前2个按钮
    }
  }

  const simplifiedButtons = getSimplifiedButtons(processedButtons)

  // 极简设计：只显示最重要的按钮，使用更协调的设计
  return (
    <div className="flex items-center gap-3">
      {simplifiedButtons.map((button, index) => (
        <button
          key={index}
          onClick={button.onClick}
          className={`flex items-center justify-center w-6 h-6 transition-all duration-200 ${
            button.highlight || button.active
              ? 'text-neutral-800 dark:text-neutral-100'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100'
          } ${button.className || ''}`}
          title={button.text} // 添加 tooltip 显示按钮功能
        >
          {/* 优先显示图标，保持与左侧图标的视觉一致性 */}
          {(() => {
            const icon = getIconForButton(button.text, button.icon);
            if (icon) {
              return <div className="w-4 h-4 flex items-center justify-center">{icon}</div>;
            }

            // 如果没有图标，显示简化的符号
            const getSymbol = (text: string) => {
              const symbolMap: Record<string, string> = {
                '新建方案': '+',
                '导入方案': '↓',
                '添加咖啡豆': '+',
                '导入咖啡豆': '↓',
                '添加笔记': '+',
                '通用方案': '通',
                '自定义方案': '自',
              };
              return symbolMap[text] || '+';
            };

            return <span className="text-sm font-light">{getSymbol(button.text)}</span>;
          })()}
        </button>
      ))}
    </div>
  )
}

export default NavigationToolbar
