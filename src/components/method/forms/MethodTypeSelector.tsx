import React from 'react';
import { SettingsOptions } from '../../settings/Settings';
// import hapticsUtils from '@/lib/ui/haptics';

interface MethodTypeSelectorProps {
    methodType: 'common' | 'custom';
    settings: SettingsOptions;
    onSelectMethodType: (type: 'common' | 'custom') => void;
    hideSelector?: boolean;
    showInTabContent?: boolean;
}

const MethodTypeSelector: React.FC<MethodTypeSelectorProps> = ({
    methodType: _methodType,
    settings: _settings,
    onSelectMethodType: _onSelectMethodType,
    hideSelector: _hideSelector = false,
    showInTabContent: _showInTabContent = true
}) => {
    const _handleMethodTypeChange = (_type: 'common' | 'custom') => {
        // 这个函数现在不再使用，但保留以防向后兼容
    };

    // 注意：由于方案类型选择现在已经集成到了TabContent组件中，
    // 这个组件不再需要渲染任何内容。保留它是为了向后兼容。
    return null;
};

export default MethodTypeSelector;