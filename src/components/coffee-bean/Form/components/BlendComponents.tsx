import React from 'react';
import { useTranslations } from 'next-intl';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import { BlendComponent } from '../types';
import {
    isCustomPreset,
    removeCustomPreset,
    getFullPresets
} from '../constants';

interface BlendComponentsProps {
    components: BlendComponent[];
    onAdd: () => void;
    onRemove: (index: number) => void;
    onChange: (index: number, field: keyof BlendComponent, value: string | number) => void;
}

const BlendComponents: React.FC<BlendComponentsProps> = ({
    components,
    onAdd,
    onRemove,
    onChange,
}) => {
    // 使用翻译钩子
    const t = useTranslations('beanForm.blendComponents')
    // 计算总百分比
    const totalPercentage = components.reduce((sum, component) => 
        component.percentage ? sum + component.percentage : sum, 0);
    
    // 计算百分比状态
    const percentageStatus = totalPercentage === 100 
        ? 'text-green-600 dark:text-green-400' 
        : (totalPercentage > 100 ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400');
    
    // 计算特定成分可用的最大百分比
    const calculateMaxAllowed = (index: number): number => {
        const totalOtherPercentage = components.reduce((sum, comp, i) => 
            i !== index && comp.percentage ? sum + comp.percentage : sum, 0);
        return 100 - totalOtherPercentage;
    };
    
    // 检查是否可以添加更多成分
    // 只有当组件数量大于1（拼配咖啡）时才考虑百分比限制
    const canAddMoreComponents = components.length === 1 || totalPercentage < 100;
    
    // 判断值是否为自定义预设
    const checkIsCustomPreset = (key: 'origins' | 'processes' | 'varieties', value: string): boolean => {
        return isCustomPreset(key, value);
    };
    
    // 处理删除自定义预设
    const handleRemovePreset = (key: 'origins' | 'processes' | 'varieties', value: string): void => {
        removeCustomPreset(key, value);
        // 强制重新渲染
        setForceUpdate(prev => prev + 1);
    };
    
    // 添加forceUpdate状态以在删除预设时触发重新渲染
    const [_forceUpdate, setForceUpdate] = React.useState(0);
    
    // 每次在渲染时获取最新的预设列表
    const currentOrigins = getFullPresets('origins');
    const currentProcesses = getFullPresets('processes');
    const currentVarieties = getFullPresets('varieties');


        
    return (
        <div className="space-y-5 w-full">
            <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {t('label')}
                </label>
                <button
                    type="button"
                    onClick={onAdd}
                    disabled={!canAddMoreComponents}
                    className={`text-xs px-3 py-1 rounded-full transition-colors ${
                        !canAddMoreComponents
                            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'
                    }`}
                >
                    {t('addComponent')}
                </button>
            </div>

            <div className="space-y-4">
                {components.map((component, index) => {
                    // 计算当前成分的最大允许百分比
                    const maxAllowed = calculateMaxAllowed(index);
                    
                    return (
                        <div key={index}>
                            <div className="flex items-center justify-between mb-3">
                                {components.length > 1 && (
                                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                        {t('component')} #{index + 1}
                                    </span>
                                )}
                                {components.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => onRemove(index)}
                                        className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                                    >
                                        {t('remove')}
                                    </button>
                                )}
                            </div>

                            {components.length > 1 && (
                                <div className="space-y-1 mb-3">
                                    <label className="block text-xs text-neutral-500 dark:text-neutral-400">
                                        {t('percentage.label')}
                                        {maxAllowed === 0 && (
                                            <span className="ml-1 text-amber-600 dark:text-amber-400">
                                                {t('percentage.maxReached')}
                                            </span>
                                        )}
                                    </label>
                                    <AutocompleteInput
                                        value={component.percentage !== undefined ? component.percentage.toString() : ''}
                                        onChange={(value) => onChange(index, 'percentage', value)}
                                        placeholder={t('percentage.placeholder', { max: maxAllowed })}
                                        unit={t('percentage.unit')}
                                        inputType="tel"
                                        clearable={true}
                                        suggestions={[]}
                                        maxValue={maxAllowed} // 动态计算当前成分可用的最大百分比
                                        disabled={maxAllowed === 0 && !component.percentage}
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                                <AutocompleteInput
                                    label={t('origin.label')}
                                    value={component.origin || ''}
                                    onChange={(value) => onChange(index, 'origin', value)}
                                    placeholder={t('origin.placeholder')}
                                    suggestions={currentOrigins}
                                    clearable
                                    isCustomPreset={(value) => checkIsCustomPreset('origins', value)}
                                    onRemovePreset={(value) => handleRemovePreset('origins', value)}
                                />

                                <AutocompleteInput
                                    label={t('process.label')}
                                    value={component.process || ''}
                                    onChange={(value) => onChange(index, 'process', value)}
                                    placeholder={t('process.placeholder')}
                                    suggestions={currentProcesses}
                                    clearable
                                    isCustomPreset={(value) => checkIsCustomPreset('processes', value)}
                                    onRemovePreset={(value) => handleRemovePreset('processes', value)}
                                />

                                <AutocompleteInput
                                    label={t('variety.label')}
                                    value={component.variety || ''}
                                    onChange={(value) => onChange(index, 'variety', value)}
                                    placeholder={t('variety.placeholder')}
                                    suggestions={currentVarieties}
                                    clearable
                                    isCustomPreset={(value) => checkIsCustomPreset('varieties', value)}
                                    onRemovePreset={(value) => handleRemovePreset('varieties', value)}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {components.length > 1 && (
                <div className={`text-xs ${percentageStatus} flex items-center justify-between mt-1`}>
                    <span>{t('totalRatio', { total: totalPercentage })}</span>
                    {totalPercentage !== 100 && (
                        <span>
                            {totalPercentage < 100
                                ? t('remaining', { remaining: 100 - totalPercentage })
                                : t('excess', { excess: totalPercentage - 100 })
                            }
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default BlendComponents; 