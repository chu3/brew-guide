'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { availableGrinders } from '@/lib/core/config'
import { getCategorizedGrindSizes } from '@/lib/utils/grindUtils'
import { useConfigTranslation } from '@/lib/utils/i18n-config'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from '@/components/coffee-bean/ui/select'
import { SettingsOptions, CustomGrinder } from './Settings'
import hapticsUtils from '@/lib/ui/haptics'
import confetti from 'canvas-confetti'

interface GrinderSettingsProps {
    settings: SettingsOptions;
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void;
}

const GrinderSettings: React.FC<GrinderSettingsProps> = ({
    settings,
    handleChange
}) => {
    // 使用翻译钩子
    const t = useTranslations('settings.grinder')
    const configT = useConfigTranslation()

    // 状态管理
    const [isCreatingCustom, setIsCreatingCustom] = useState(false)
    const [editingCustomId, setEditingCustomId] = useState<string | null>(null)
    const [previousGrinderType, setPreviousGrinderType] = useState<string>('generic')
    const [pendingGrinderId, setPendingGrinderId] = useState<string | null>(null)
    // 研磨度键名映射
    const grindSizeKeys = {
        '极细': 'ultraFine',
        '特细': 'extraFine',
        '细': 'fine',
        '中细': 'mediumFine',
        '中细偏粗': 'mediumFineCoarse',
        '中粗': 'mediumCoarse',
        '粗': 'coarse',
        '特粗': 'extraCoarse',
        '意式': 'espresso',
        '摩卡壶': 'moka',
        '手冲': 'pourOver',
        '法压壶': 'frenchPress',
        '冷萃': 'coldBrew'
    }

    // 获取翻译的研磨度名称
    const getTranslatedGrindSizeName = (chineseKey: string): string => {
        const englishKey = grindSizeKeys[chineseKey as keyof typeof grindSizeKeys]
        return englishKey ? t(`grindSizes.${englishKey}`) : chineseKey
    }

    // 基础研磨度列表（用于表单）
    const basicGrindSizeKeys = ['极细', '特细', '细', '中细', '中细偏粗', '中粗', '粗', '特粗']
    // 应用研磨度列表（用于表单）
    const applicationGrindSizeKeys = ['意式', '摩卡壶', '手冲', '法压壶', '冷萃']

    const [customGrinderForm, setCustomGrinderForm] = useState({
        name: '',
        unit: '', // 添加研磨度单位字段
        grindSizes: {
            极细: '',
            特细: '',
            细: '',
            中细: '',
            中细偏粗: '',
            中粗: '',
            粗: '',
            特粗: '',
            意式: '',
            摩卡壶: '',
            手冲: '',
            法压壶: '',
            冷萃: ''
        }
    })

    // 常见研磨度单位预设
    const commonUnits = useMemo(() => [
        { key: 'grid', value: t('units.grid') },
        { key: 'circle', value: t('units.circle') },
        { key: 'gear', value: t('units.gear') },
        { key: 'scale', value: t('units.scale') },
        { key: 'mm', value: t('units.mm') },
        { key: 'level', value: t('units.level') }
    ], [t])

    // 从研磨度数据中提取单位的辅助函数
    const extractUnitFromGrindSizes = (grindSizes: Record<string, string>): string => {
        // 查找第一个非空的研磨度值
        for (const value of Object.values(grindSizes)) {
            if (value && value.trim()) {
                // 使用正则表达式提取单位（非数字、非连字符、非空格的字符）
                const match = value.match(/[^\d\-\s\.]+/);
                if (match) {
                    return match[0];
                }
            }
        }
        return '';
    }

    // 从研磨度值中提取数值部分的辅助函数
    const extractNumberFromGrindSize = (value: string): string => {
        if (!value || !value.trim()) return '';
        // 提取数字、连字符、小数点和空格
        const match = value.match(/[\d\-\s\.]+/);
        return match ? match[0].trim() : '';
    }

    // 更新单位（不自动应用到输入值，只更新单位状态）
    const updateUnit = (unit: string) => {
        setCustomGrinderForm(prev => ({
            ...prev,
            unit
        }));
    }

    // 监听自定义磨豆机列表变化，当有待处理的磨豆机ID时自动选择
    useEffect(() => {
        if (pendingGrinderId && settings.customGrinders) {
            const grinder = settings.customGrinders.find(g => g.id === pendingGrinderId)
            if (grinder) {
                handleChange('grindType', pendingGrinderId)
                setPendingGrinderId(null)
            }
        }
    }, [settings.customGrinders, pendingGrinderId])

    // 获取所有磨豆机（包括自定义的和添加选项）- 使用 useMemo 缓存
    const allGrinders = useMemo(() => {
        const customGrinders = settings.customGrinders || []
        const translatedGrinders = availableGrinders.map(grinder => ({
            ...grinder,
            name: configT.translateGrinder(grinder.id)
        }))
        const addCustomOption = {
            id: 'add_custom',
            name: t('addCustomGrinder'),
            grindSizes: {}
        }
        return [...translatedGrinders, ...customGrinders, addCustomOption]
    }, [settings.customGrinders, t, configT])

    // 生成自定义磨豆机ID
    const generateCustomGrinderId = () => {
        const timestamp = Date.now()
        return `custom_grinder_${timestamp}`
    }

    // 开始创建自定义磨豆机
    const startCreatingCustomGrinder = () => {
        // 保存当前选中的磨豆机类型
        setPreviousGrinderType(settings.grindType)
        setIsCreatingCustom(true)
        setEditingCustomId(null)
        setCustomGrinderForm({
            name: '',
            unit: '',
            grindSizes: {
                极细: '',
                特细: '',
                细: '',
                中细: '',
                中细偏粗: '',
                中粗: '',
                粗: '',
                特粗: '',
                意式: '',
                摩卡壶: '',
                手冲: '',
                法压壶: '',
                冷萃: ''
            }
        })
    }

    // 开始编辑自定义磨豆机
    const startEditingCustomGrinder = (grinder: CustomGrinder) => {
        // 保存当前选中的磨豆机类型
        setPreviousGrinderType(settings.grindType)
        setIsCreatingCustom(true)
        setEditingCustomId(grinder.id)

        const extractedUnit = extractUnitFromGrindSizes(grinder.grindSizes);

        setCustomGrinderForm({
            name: grinder.name,
            unit: extractedUnit, // 从现有数据中提取单位
            grindSizes: {
                // 提取数值部分，去掉单位，便于编辑
                极细: extractNumberFromGrindSize(grinder.grindSizes.极细 || ''),
                特细: extractNumberFromGrindSize(grinder.grindSizes.特细 || ''),
                细: extractNumberFromGrindSize(grinder.grindSizes.细 || ''),
                中细: extractNumberFromGrindSize(grinder.grindSizes.中细 || ''),
                中细偏粗: extractNumberFromGrindSize(grinder.grindSizes.中细偏粗 || ''),
                中粗: extractNumberFromGrindSize(grinder.grindSizes.中粗 || ''),
                粗: extractNumberFromGrindSize(grinder.grindSizes.粗 || ''),
                特粗: extractNumberFromGrindSize(grinder.grindSizes.特粗 || ''),
                意式: extractNumberFromGrindSize(grinder.grindSizes.意式 || ''),
                摩卡壶: extractNumberFromGrindSize(grinder.grindSizes.摩卡壶 || ''),
                手冲: extractNumberFromGrindSize(grinder.grindSizes.手冲 || ''),
                法压壶: extractNumberFromGrindSize(grinder.grindSizes.法压壶 || ''),
                冷萃: extractNumberFromGrindSize(grinder.grindSizes.冷萃 || '')
            }
        })
        // 切换到编辑模式
        handleChange('grindType', 'add_custom')
    }

    // 保存自定义磨豆机
    const saveCustomGrinder = () => {
        if (!customGrinderForm.name.trim()) {
            alert(t('nameRequired'))
            return
        }

        // 组合数值和单位生成最终的研磨度数据
        const finalGrindSizes: Record<string, string> = {};
        Object.keys(customGrinderForm.grindSizes).forEach(key => {
            const value = customGrinderForm.grindSizes[key as keyof typeof customGrinderForm.grindSizes];
            if (value && value.trim()) {
                // 如果有单位，则组合数值和单位；否则保持原值
                finalGrindSizes[key] = customGrinderForm.unit.trim()
                    ? `${value.trim()}${customGrinderForm.unit}`
                    : value.trim();
            } else {
                finalGrindSizes[key] = '';
            }
        });

        const customGrinders = settings.customGrinders || []

        if (editingCustomId) {
            // 编辑现有磨豆机
            const updatedGrinders = customGrinders.map(grinder =>
                grinder.id === editingCustomId
                    ? {
                        ...grinder,
                        name: customGrinderForm.name,
                        grindSizes: finalGrindSizes
                      }
                    : grinder
            )

            // 设置待处理的磨豆机ID
            setPendingGrinderId(editingCustomId)
            // 更新磨豆机列表
            handleChange('customGrinders', updatedGrinders)
        } else {
            // 创建新磨豆机
            const newGrinderId = generateCustomGrinderId()
            const newGrinder: CustomGrinder = {
                id: newGrinderId,
                name: customGrinderForm.name,
                grindSizes: finalGrindSizes,
                isCustom: true
            }

            const updatedGrinders = [...customGrinders, newGrinder]

            // 设置待处理的磨豆机ID
            setPendingGrinderId(newGrinderId)
            // 更新磨豆机列表
            handleChange('customGrinders', updatedGrinders)
        }

        // 重置表单
        setIsCreatingCustom(false)
        setEditingCustomId(null)
    }

    // 删除自定义磨豆机
    const deleteCustomGrinder = (grinderId: string) => {
        if (confirm(t('deleteConfirm'))) {
            const customGrinders = settings.customGrinders || []
            const updatedGrinders = customGrinders.filter(grinder => grinder.id !== grinderId)

            // 如果当前选中的是被删除的磨豆机，先切换到通用
            if (settings.grindType === grinderId) {
                handleChange('grindType', 'generic')
            }

            // 然后删除磨豆机
            handleChange('customGrinders', updatedGrinders)
        }
    }

    // 取消编辑
    const cancelEditing = () => {
        setIsCreatingCustom(false)
        setEditingCustomId(null)
        // 回到之前选中的磨豆机
        handleChange('grindType', previousGrinderType)
    }

    // 导出自定义磨豆机
    const exportCustomGrinder = (grinder: CustomGrinder) => {
        const exportData = {
            name: grinder.name,
            grindSizes: grinder.grindSizes
        }
        const jsonString = JSON.stringify(exportData, null, 2)
        navigator.clipboard.writeText(jsonString).then(() => {
            alert(t('exportSuccess'))
        }).catch(() => {
            // 降级方案：显示文本供用户手动复制
            const textarea = document.createElement('textarea')
            textarea.value = jsonString
            textarea.style.position = 'fixed'
            textarea.style.left = '-999999px'
            textarea.style.top = '-999999px'
            document.body.appendChild(textarea)
            textarea.focus()
            textarea.select()
            try {
                document.execCommand('copy')
                alert(t('exportSuccess'))
            } catch (_err) {
                alert(t('exportFallback') + jsonString)
            }
            document.body.removeChild(textarea)
        })
    }

    // 导入自定义磨豆机
    const importCustomGrinder = () => {
        const jsonString = prompt(t('importPrompt'))
        if (!jsonString) return

        try {
            const importData = JSON.parse(jsonString)

            // 验证数据格式
            if (!importData.name || !importData.grindSizes) {
                throw new Error('数据格式不正确')
            }

            // 创建新的自定义磨豆机
            const newGrinderId = generateCustomGrinderId()
            const newGrinder: CustomGrinder = {
                id: newGrinderId,
                name: importData.name,
                grindSizes: {
                    极细: importData.grindSizes.极细 || '',
                    特细: importData.grindSizes.特细 || '',
                    细: importData.grindSizes.细 || '',
                    中细: importData.grindSizes.中细 || '',
                    中细偏粗: importData.grindSizes.中细偏粗 || '',
                    中粗: importData.grindSizes.中粗 || '',
                    粗: importData.grindSizes.粗 || '',
                    特粗: importData.grindSizes.特粗 || '',
                    意式: importData.grindSizes.意式 || '',
                    摩卡壶: importData.grindSizes.摩卡壶 || '',
                    手冲: importData.grindSizes.手冲 || '',
                    法压壶: importData.grindSizes.法压壶 || '',
                    冷萃: importData.grindSizes.冷萃 || ''
                },
                isCustom: true
            }

            const customGrinders = settings.customGrinders || []

            // 设置待处理的磨豆机ID，导入成功后自动选择
            setPendingGrinderId(newGrinderId)

            // 更新磨豆机列表
            handleChange('customGrinders', [...customGrinders, newGrinder])

            alert(t('importSuccess'))
        } catch (_error) {
            alert(t('importError'))
        }
    }

    // 触发彩带特效
    const showConfetti = () => {
        // Find the selected grinder button element
        const selectedGrinderButton = document.getElementById(`grinder-button-${settings.grindType}`);
        if (!selectedGrinderButton) return;

        // 获取按钮元素的位置信息
        const rect = selectedGrinderButton.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;

        // 创建彩带效果
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { x, y },
            colors: ['#FFD700', '#FF6347', '#9370DB', '#3CB371', '#4682B4'],
            zIndex: 9999,
            shapes: ['square', 'circle'],
            scalar: 0.8,
        });

        // 烟花效果
        setTimeout(() => {
            confetti({
                particleCount: 50,
                spread: 90,
                origin: { x, y },
                colors: ['#FFD700', '#FF6347', '#9370DB'],
                zIndex: 9999,
                startVelocity: 30,
                gravity: 0.8,
                shapes: ['star'],
                scalar: 1,
            });
        }, 250);
    }

    // 获取当前选中磨豆机的显示名称（使用 useMemo 缓存结果）
    const currentGrinderDisplayName = useMemo(() => {
        if (settings.grindType === 'add_custom') {
            return editingCustomId ? t('editCustomGrinder') : t('addCustomGrinder');
        }

        const selectedGrinder = allGrinders.find(g => g.id === settings.grindType);
        if (selectedGrinder) {
            // 如果是自定义磨豆机，直接使用名称；否则使用翻译
            if ('isCustom' in selectedGrinder && selectedGrinder.isCustom) {
                return selectedGrinder.name;
            } else {
                return configT.translateGrinder(selectedGrinder.id);
            }
        }
        return t('selectGrinder');
    }, [settings.grindType, allGrinders, editingCustomId, t, configT]);

    // 处理磨豆机类型变更
    const handleGrinderChange = (value: string) => {
        // 如果选择的是"添加自定义磨豆机"，则开始创建流程
        if (value === 'add_custom') {
            startCreatingCustomGrinder();
            handleChange('grindType', 'add_custom');
            return;
        }

        // 如果切换到其他磨豆机，取消创建/编辑状态
        if (isCreatingCustom) {
            setIsCreatingCustom(false);
            setEditingCustomId(null);
        }

        handleChange('grindType', value);

        // 当选择幻刺时触发彩带特效
        if (value === 'phanci_pro') {
            showConfetti();
            // 选择幻刺时也提供触感反馈
            if (settings.hapticFeedback) {
                hapticsUtils.medium();
            }
        }
    };

    // 渲染磨豆机参考信息
    const renderGrinderReference = () => {
        if (settings.grindType === 'add_custom') {
            return null;
        }

        const selectedGrinder = allGrinders.find(g => g.id === settings.grindType);

        if (!selectedGrinder || !selectedGrinder.grindSizes || Object.keys(selectedGrinder.grindSizes).length === 0) {
            return null;
        }

        const { basicGrindSizes, applicationGrindSizes } = getCategorizedGrindSizes(settings.grindType, settings.customGrinders);

        const elements = [];

        // 基础研磨度部分
        elements.push(
            <div key="basic-grind-sizes" className="mb-3">
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                    {t('basicGrindSizes')}
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {Object.entries(basicGrindSizes).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm text-neutral-700 dark:text-neutral-300">
                            <span className="font-medium">{getTranslatedGrindSizeName(key)}</span>
                            <span>{configT.translateGrindSizeValue(value as string)}</span>
                        </div>
                    ))}
                </div>
            </div>
        );

        // 特定应用研磨度部分
        if (Object.keys(applicationGrindSizes).length > 0) {
            elements.push(
                <div key="application-grind-sizes" className="mb-3">
                    <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                        {t('applicationGrindSizes')}
                    </p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        {Object.entries(applicationGrindSizes).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-sm text-neutral-700 dark:text-neutral-300">
                                <span className="font-medium">{getTranslatedGrindSizeName(key)}</span>
                                <span>{configT.translateGrindSizeValue(value as string)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // 自定义磨豆机操作按钮
        if ('isCustom' in selectedGrinder && selectedGrinder.isCustom) {
            elements.push(
                <div key="custom-grinder-actions" className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                        {t('customGrinderActions')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => startEditingCustomGrinder(selectedGrinder as CustomGrinder)}
                            className="px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            {t('edit')}
                        </button>
                        <button
                            onClick={() => deleteCustomGrinder(selectedGrinder.id)}
                            className="px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            {t('delete')}
                        </button>
                        <button
                            onClick={() => exportCustomGrinder(selectedGrinder as CustomGrinder)}
                            className="px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            {t('export')}
                        </button>
                    </div>
                </div>
            );
        }

        // 数据来源和用户调研信息 - 对所有磨豆机显示
        elements.push(
            <div key="data-source" className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {t('dataSource')}
                </p>
                <div className="mt-2">
                    <a
                        href="https://wj.qq.com/s2/19815833/44ae/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 flex items-center"
                    >
                        <span>{t('surveyLink')}</span>
                    </a>
                </div>
            </div>
        );

        return (
            <div className="mt-3 border-l-2 border-neutral-300 dark:border-neutral-700 pl-4 py-2">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                    {configT.translateGrinder(selectedGrinder.id) || selectedGrinder.name} {t('grinderReference')}
                </p>
                {elements}
            </div>
        );
    };

    return (
        <div className="px-6 py-4">
            <h3 className="text-sm uppercase font-medium tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                {t('title')}
            </h3>

            <div className="flex items-center justify-between py-2">
                <label
                    htmlFor={`grinder-select-${settings.grindType}`}
                    className="text-sm font-medium text-neutral-800 dark:text-neutral-200"
                >
                    {t('grinderType')}
                </label>
                <div className="relative">
                    <Select
                        value={settings.grindType}
                        onValueChange={handleGrinderChange}
                    >
                        <SelectTrigger
                            id={`grinder-button-${settings.grindType}`}
                            variant="minimal"
                            className="w-auto text-right text-sm text-neutral-600 dark:text-neutral-400"
                        >
                            <SelectValue placeholder={t('selectGrinder')}>
                                {currentGrinderDisplayName}
                            </SelectValue>
                            <svg
                                className="h-4 w-4 ml-1 text-neutral-500"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                            </svg>
                        </SelectTrigger>
                        <SelectContent className="max-h-[40vh] overflow-y-auto">
                            {availableGrinders.map((grinder) => (
                                <SelectItem
                                    key={grinder.id}
                                    value={grinder.id}
                                >
                                    {configT.translateGrinder(grinder.id)}
                                </SelectItem>
                            ))}

                            {/* 自定义磨豆机 */}
                            {settings.customGrinders && settings.customGrinders.length > 0 && (
                                <>
                                    <SelectSeparator />
                                    {settings.customGrinders.map((grinder) => (
                                        <SelectItem
                                            key={grinder.id}
                                            value={grinder.id}
                                        >
                                            {grinder.name}
                                        </SelectItem>
                                    ))}
                                </>
                            )}

                            <SelectSeparator />
                            <SelectItem value="add_custom">
                                <span className="text-neutral-600 dark:text-neutral-400">{t('addCustomGrinder')}</span>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Display grinder specific reference grind sizes if available */}
            {settings.grindType === 'add_custom' && (
                <div className="mt-3 border-l-2 border-neutral-300 dark:border-neutral-700 pl-4 py-2">
                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                        {editingCustomId ? t('editCustomGrinder') : t('createCustomGrinder')}
                    </p>

                    {/* 磨豆机名称输入 */}
                    <div className="mb-4">
                        <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2 block">
                            {t('grinderName')}
                        </label>
                        <input
                            type="text"
                            value={customGrinderForm.name}
                            onChange={(e) => setCustomGrinderForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder={t('grinderNamePlaceholder')}
                            className="w-full px-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                        />
                    </div>

                    {/* 研磨度单位选择 */}
                    <div className="mb-4">
                        <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2 block">
                            {t('grinderUnit')}
                        </label>
                        <div className="flex gap-2 mb-2">
                            {/* 常用单位快速选择 */}
                            {commonUnits.map((unit) => (
                                <button
                                    key={unit.key}
                                    onClick={() => updateUnit(unit.value)}
                                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                        customGrinderForm.unit === unit.value
                                            ? 'bg-neutral-700 dark:bg-neutral-600 text-white'
                                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                    }`}
                                >
                                    {unit.value}
                                </button>
                            ))}
                        </div>
                        {/* 自定义单位输入 */}
                        <input
                            type="text"
                            value={customGrinderForm.unit}
                            onChange={(e) => updateUnit(e.target.value)}
                            placeholder={t('customUnitPlaceholder')}
                            className="w-full px-3 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                        />
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {t('unitDescription')}
                        </p>
                    </div>

                    {/* 基础研磨度部分 */}
                    <div className="mb-3">
                        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                            {t('basicGrindSizes')}
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                            {basicGrindSizeKeys.map((key) => (
                                <div key={key} className="flex justify-between items-center text-sm text-neutral-700 dark:text-neutral-300">
                                    <span className="font-medium">{getTranslatedGrindSizeName(key)}</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            value={customGrinderForm.grindSizes[key as keyof typeof customGrinderForm.grindSizes]}
                                            onChange={(e) => setCustomGrinderForm(prev => ({
                                                ...prev,
                                                grindSizes: {
                                                    ...prev.grindSizes,
                                                    [key]: e.target.value
                                                }
                                            }))}
                                            placeholder={t('grindSizePlaceholder')}
                                            className="w-16 px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                        />
                                        {customGrinderForm.unit && (
                                            <span className="text-xs text-neutral-500 dark:text-neutral-400 min-w-0">
                                                {customGrinderForm.unit}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 特定应用研磨度部分 */}
                    <div className="mb-3">
                        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                            {t('applicationGrindSizes')}
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                            {applicationGrindSizeKeys.map((key) => (
                                <div key={key} className="flex justify-between items-center text-sm text-neutral-700 dark:text-neutral-300">
                                    <span className="font-medium">{getTranslatedGrindSizeName(key)}</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            value={customGrinderForm.grindSizes[key as keyof typeof customGrinderForm.grindSizes]}
                                            onChange={(e) => setCustomGrinderForm(prev => ({
                                                ...prev,
                                                grindSizes: {
                                                    ...prev.grindSizes,
                                                    [key]: e.target.value
                                                }
                                            }))}
                                            placeholder={t('grindSizePlaceholder')}
                                            className="w-16 px-2 py-1 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700 rounded text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                                        />
                                        {customGrinderForm.unit && (
                                            <span className="text-xs text-neutral-500 dark:text-neutral-400 min-w-0">
                                                {customGrinderForm.unit}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={saveCustomGrinder}
                            className="px-3 py-1.5 text-xs font-medium bg-neutral-700 dark:bg-neutral-600 text-white rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-500 transition-colors"
                        >
                            {t('save')}
                        </button>
                        <button
                            onClick={cancelEditing}
                            className="px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={importCustomGrinder}
                            className="px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            {t('import')}
                        </button>
                    </div>
                </div>
            )}

            {/* 显示选中磨豆机的参考研磨度 */}
            {renderGrinderReference()}
        </div>
    );
};

export default GrinderSettings;