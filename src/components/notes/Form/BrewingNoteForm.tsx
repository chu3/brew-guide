'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Image from 'next/image'

import type { BrewingNoteData, CoffeeBean } from '@/types/app'
import AutoResizeTextarea from '@/components/common/forms/AutoResizeTextarea'
import NoteFormHeader from '@/components/notes/ui/NoteFormHeader'
import { captureImage, compressBase64Image } from '@/lib/utils/imageCapture'
import { equipmentList, commonMethods, type Method, type CustomEquipment } from '@/lib/core/config'
import { loadCustomEquipments } from '@/lib/managers/customEquipments'
import { loadCustomMethods } from '@/lib/managers/customMethods'
import { formatGrindSize, hasSpecificGrindScale, getGrindScaleUnit } from '@/lib/utils/grindUtils'
import { SettingsOptions } from '@/components/settings/Settings'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/coffee-bean/ui/select'
import CoffeeBeanSelector from './CoffeeBeanSelector'
import { useCoffeeBeanData } from './hooks/useCoffeeBeanData'

// 常量定义
const ROAST_LEVELS = [
    '极浅烘焙', '浅度烘焙', '中浅烘焙',
    '中度烘焙', '中深烘焙', '深度烘焙'
] as const

const TASTE_LABELS = {
    acidity: '酸度',
    sweetness: '甜度',
    bitterness: '苦度',
    body: '口感'
} as const

// 动画类型到器具ID的映射
const ANIMATION_TYPE_MAPPING: Record<string, string> = {
    'v60': 'V60',
    'clever': 'CleverDripper',
    'espresso': 'Espresso',
    'kalita': 'Kalita',
    'origami': 'Origami'
}

// 默认方案参数
const DEFAULT_METHOD_PARAMS = {
    coffee: '15g',
    water: '225g',
    ratio: '1:15',
    grindSize: '中细',
    temp: '92°C'
} as const

// 工具函数：获取器具对应的通用方案
const getCommonMethodsForEquipment = (
    equipmentId: string,
    availableEquipments: (typeof equipmentList[0] | CustomEquipment)[]
): Method[] => {
    // 先检查是否是预定义器具
    if (commonMethods[equipmentId]) {
        return commonMethods[equipmentId];
    }

    // 检查是否是自定义器具
    const customEquipment = availableEquipments.find(
        eq => eq.id === equipmentId && 'isCustom' in eq && eq.isCustom
    ) as CustomEquipment | undefined;

    if (customEquipment?.animationType) {
        const baseEquipmentId = ANIMATION_TYPE_MAPPING[customEquipment.animationType.toLowerCase()] || 'V60';
        return commonMethods[baseEquipmentId] || [];
    }

    return [];
}

// 工具函数：获取参数的默认值
const getParamValue = (param: string | undefined, defaultKey: keyof typeof DEFAULT_METHOD_PARAMS): string => {
    return param || DEFAULT_METHOD_PARAMS[defaultKey];
}

const SLIDER_STYLES = `relative h-px w-full appearance-none bg-neutral-300 dark:bg-neutral-600 cursor-pointer touch-none
[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-solid
[&::-webkit-slider-thumb]:border-neutral-300 [&::-webkit-slider-thumb]:bg-neutral-50
[&::-webkit-slider-thumb]:shadow-none [&::-webkit-slider-thumb]:outline-none
dark:[&::-webkit-slider-thumb]:border-neutral-600 dark:[&::-webkit-slider-thumb]:bg-neutral-900
[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none
[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-solid
[&::-moz-range-thumb]:border-neutral-300 [&::-moz-range-thumb]:bg-neutral-50
[&::-moz-range-thumb]:shadow-none [&::-moz-range-thumb]:outline-none
dark:[&::-moz-range-thumb]:border-neutral-600 dark:[&::-moz-range-thumb]:bg-neutral-900`

// 类型定义
interface TasteRatings {
    acidity: number;
    sweetness: number;
    bitterness: number;
    body: number;
}

interface FormData {
    coffeeBeanInfo: {
        name: string;
        roastLevel: string;
    };
    image?: string;
    rating: number;
    taste: TasteRatings;
    notes: string;
}

interface BrewingNoteFormProps {
    id?: string;
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: BrewingNoteData) => void;
    initialData: Partial<BrewingNoteData> & {
        coffeeBean?: CoffeeBean | null;
    };
    inBrewPage?: boolean;
    showSaveButton?: boolean;
    onSaveSuccess?: () => void;
    hideHeader?: boolean;
    onTimestampChange?: (timestamp: Date) => void;
    settings?: SettingsOptions;
}



// 工具函数
const normalizeRoastLevel = (roastLevel?: string): string => {
    if (!roastLevel) return '中度烘焙';
    if (roastLevel.endsWith('烘焙')) return roastLevel;

    const roastMap: Record<string, string> = {
        '极浅': '极浅烘焙', '浅度': '浅度烘焙', '中浅': '中浅烘焙',
        '中度': '中度烘焙', '中深': '中深烘焙', '深度': '深度烘焙'
    };

    return roastMap[roastLevel] ||
           Object.entries(roastMap).find(([key]) => roastLevel.includes(key))?.[1] ||
           '中度烘焙';
};

const getInitialCoffeeBeanInfo = (initialData: BrewingNoteFormProps['initialData']) => {
    const beanInfo = initialData.coffeeBean || initialData.coffeeBeanInfo;
    return {
        name: beanInfo?.name || '',
        roastLevel: normalizeRoastLevel(beanInfo?.roastLevel)
    };
};

const extractNumericValue = (param: string): string => {
    const match = param.match(/(\d+(\.\d+)?)/);
    return match ? match[0] : '';
};

const validateNumericInput = (value: string): boolean => {
    return /^$|^[0-9]*\.?[0-9]*$/.test(value);
};



const BrewingNoteForm: React.FC<BrewingNoteFormProps> = ({
    id,
    isOpen,
    onClose,
    onSave,
    initialData,
    inBrewPage = false,
    showSaveButton = true,
    onSaveSuccess,
    hideHeader = false,
    onTimestampChange,
    settings,
}) => {

    // 咖啡豆数据和状态管理
    const { beans: coffeeBeans } = useCoffeeBeanData()
    const [selectedCoffeeBean, setSelectedCoffeeBean] = useState<CoffeeBean | null>(
        initialData.coffeeBean || null
    )
    const [showCoffeeBeanSelector, setShowCoffeeBeanSelector] = useState(false)
    const [coffeeBeanSearchQuery, setCoffeeBeanSearchQuery] = useState('')
    const [originalBeanId] = useState<string | undefined>(initialData.beanId) // 记录原始的beanId用于容量同步

    const [formData, setFormData] = useState<FormData>({
        coffeeBeanInfo: getInitialCoffeeBeanInfo(initialData),
        image: typeof initialData.image === 'string' ? initialData.image : '',
        rating: initialData?.rating || 3,
        taste: {
            acidity: initialData?.taste?.acidity || 0,
            sweetness: initialData?.taste?.sweetness || 0,
            bitterness: initialData?.taste?.bitterness || 0,
            body: initialData?.taste?.body || 0
        },
        notes: initialData?.notes || ''
    });

    // 添加时间戳状态管理
    const [timestamp, setTimestamp] = useState<Date>(
        initialData.timestamp ? new Date(initialData.timestamp) : new Date()
    );

    // 监听initialData.timestamp的变化，同步更新内部状态
    useEffect(() => {
        if (initialData.timestamp) {
            setTimestamp(new Date(initialData.timestamp));
        }
    }, [initialData.timestamp]);

    // 初始化选中的咖啡豆
    useEffect(() => {
        if (initialData.beanId && coffeeBeans.length > 0 && !selectedCoffeeBean) {
            const foundBean = coffeeBeans.find(bean => bean.id === initialData.beanId);
            if (foundBean) {
                setSelectedCoffeeBean(foundBean);
            }
        }
    }, [initialData.beanId, coffeeBeans, selectedCoffeeBean]);

    // 处理时间戳变化，同时通知外部组件
    const handleTimestampChange = (newTimestamp: Date) => {
        setTimestamp(newTimestamp);
        onTimestampChange?.(newTimestamp);
    };
    
    // 添加方案参数状态 - 分离数值和单位
    const [methodParams, setMethodParams] = useState({
        coffee: getParamValue(initialData?.params?.coffee, 'coffee'),
        water: getParamValue(initialData?.params?.water, 'water'),
        ratio: getParamValue(initialData?.params?.ratio, 'ratio'),
        grindSize: getParamValue(initialData?.params?.grindSize, 'grindSize'),
        temp: getParamValue(initialData?.params?.temp, 'temp'),
    });

    // 分离的数值状态（用于输入框显示）
    const [numericValues, setNumericValues] = useState(() => ({
        coffee: extractNumericValue(getParamValue(initialData?.params?.coffee, 'coffee')),
        water: extractNumericValue(getParamValue(initialData?.params?.water, 'water')),
        temp: extractNumericValue(getParamValue(initialData?.params?.temp, 'temp')),
        ratio: extractNumericValue(getParamValue(initialData?.params?.ratio, 'ratio').split(':')[1])
    }));

    // 添加器具和方案选择相关状态
    const [availableEquipments, setAvailableEquipments] = useState<(typeof equipmentList[0] | CustomEquipment)[]>([]);
    const [availableMethods, setAvailableMethods] = useState<Method[]>([]);
    const [customMethods, setCustomMethods] = useState<Record<string, Method[]>>({});
    const [showEquipmentMethodSelector, setShowEquipmentMethodSelector] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(initialData.equipment || '');
    const [selectedMethod, setSelectedMethod] = useState(initialData.method || '');
    
    const formRef = useRef<HTMLFormElement>(null);
    const [currentSliderValue, setCurrentSliderValue] = useState<number | null>(null);

    // 通用滑块触摸处理
    const createSliderHandlers = useCallback((
        updateFn: (value: number) => void,
        min: number = 0,
        max: number = 5,
        step: number = 1
    ) => ({
        onTouchStart: (value: number) => (e: React.TouchEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setCurrentSliderValue(value);
        },
        onTouchMove: (e: React.TouchEvent) => {
            if (currentSliderValue === null) return;
            const touch = e.touches[0];
            const target = e.currentTarget as HTMLInputElement;
            const rect = target.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
            const newValue = min + Math.round(percentage * (max - min) / step) * step;
            if (newValue !== currentSliderValue) {
                updateFn(newValue);
                setCurrentSliderValue(newValue);
            }
        },
        onTouchEnd: () => setCurrentSliderValue(null)
    }), [currentSliderValue]);
    


    // 加载器具和方案数据
    useEffect(() => {
        const loadEquipmentsAndMethods = async () => {
            try {
                // 加载自定义器具
                const customEquips = await loadCustomEquipments();

                // 合并所有器具
                const allEquipments = [
                    ...equipmentList.map(eq => ({ ...eq, isCustom: false })),
                    ...customEquips
                ];
                setAvailableEquipments(allEquipments);

                // 加载自定义方案
                const customMethods = await loadCustomMethods();
                setCustomMethods(customMethods);

                // 如果有选中的器具，加载对应的方案
                if (initialData.equipment) {
                    const equipmentMethods = customMethods[initialData.equipment] || [];
                    const commonEquipmentMethods = getCommonMethodsForEquipment(initialData.equipment, allEquipments);
                    setAvailableMethods([...equipmentMethods, ...commonEquipmentMethods]);
                }
            } catch (error) {
                // Log error in development only
                if (process.env.NODE_ENV === 'development') {
                    console.error('加载器具和方案数据失败:', error);
                }
            }
        };

        loadEquipmentsAndMethods();
    }, [initialData.equipment]);

    // 事件监听
    useEffect(() => {
        const handleGlobalTouchEnd = () => setCurrentSliderValue(null);

        const handleMethodParamsChange = (e: CustomEvent) => {
            if (e.detail?.params) {
                const params = e.detail.params;
                setMethodParams(prev => ({
                    coffee: params.coffee || prev.coffee,
                    water: params.water || prev.water,
                    ratio: params.ratio || prev.ratio,
                    grindSize: params.grindSize || prev.grindSize,
                    temp: params.temp || prev.temp
                }));
            }
        };

        // 点击外部区域关闭下拉选择器
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-equipment-method-selector]')) {
                setShowEquipmentMethodSelector(false);
            }
        };

        document.addEventListener('touchend', handleGlobalTouchEnd);
        document.addEventListener('methodParamsChanged', handleMethodParamsChange as EventListener);
        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('touchend', handleGlobalTouchEnd);
            document.removeEventListener('methodParamsChanged', handleMethodParamsChange as EventListener);
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    // 更新方案参数的通用函数
    const updateMethodParams = useCallback((params: Method['params']) => {
        setMethodParams(params);
        setNumericValues({
            coffee: extractNumericValue(getParamValue(params.coffee, 'coffee')),
            water: extractNumericValue(getParamValue(params.water, 'water')),
            temp: extractNumericValue(getParamValue(params.temp, 'temp')),
            ratio: extractNumericValue(getParamValue(params.ratio, 'ratio').split(':')[1])
        });
    }, []);

    // 简化的数据更新逻辑
    const prevInitialDataRef = useRef<typeof initialData>(initialData);

    useEffect(() => {
        const prev = prevInitialDataRef.current;
        const current = initialData;

        // 检查咖啡豆信息变化
        const beanChanged = prev.coffeeBean?.id !== current.coffeeBean?.id ||
                           prev.coffeeBeanInfo?.name !== current.coffeeBeanInfo?.name;

        if (beanChanged) {
            const beanInfo = current.coffeeBean || current.coffeeBeanInfo;

            // 同步更新selectedCoffeeBean状态
            if (current.coffeeBean && current.coffeeBean.id !== selectedCoffeeBean?.id) {
                setSelectedCoffeeBean(current.coffeeBean);
            }

            setFormData(prev => ({
                ...prev,
                coffeeBeanInfo: {
                    name: beanInfo?.name || '',
                    roastLevel: normalizeRoastLevel(beanInfo?.roastLevel),
                    roastDate: beanInfo?.roastDate || ''
                }
            }));
        }

        // 检查其他数据变化
        const dataChanged = prev.rating !== current.rating ||
                           prev.notes !== current.notes ||
                           prev.image !== current.image ||
                           JSON.stringify(prev.taste) !== JSON.stringify(current.taste);

        if (dataChanged) {
            setFormData(prev => ({
                ...prev,
                image: typeof current.image === 'string' ? current.image : prev.image,
                rating: current.rating || prev.rating,
                taste: {
                    acidity: current.taste?.acidity ?? prev.taste.acidity,
                    sweetness: current.taste?.sweetness ?? prev.taste.sweetness,
                    bitterness: current.taste?.bitterness ?? prev.taste.bitterness,
                    body: current.taste?.body ?? prev.taste.body
                },
                notes: current.notes || prev.notes
            }));
        }

        // 检查参数变化
        if (JSON.stringify(prev.params) !== JSON.stringify(current.params) && current.params) {
            setMethodParams(current.params);
            setNumericValues({
                coffee: extractNumericValue(getParamValue(current.params.coffee, 'coffee')),
                water: extractNumericValue(getParamValue(current.params.water, 'water')),
                temp: extractNumericValue(getParamValue(current.params.temp, 'temp')),
                ratio: extractNumericValue(getParamValue(current.params.ratio, 'ratio').split(':')[1])
            });
        }

        prevInitialDataRef.current = current;
    }, [initialData, selectedCoffeeBean?.id]);

    // 创建评分更新函数
    const updateRating = (value: number) => {
        setFormData(prev => ({ ...prev, rating: value }));
    };

    const updateTasteRating = (key: keyof TasteRatings) => (value: number) => {
        setFormData(prev => ({
            ...prev,
            taste: { ...prev.taste, [key]: value }
        }));
    };

    // 创建滑块处理器
    const ratingHandlers = createSliderHandlers(updateRating, 1, 5, 0.5);
    const tasteHandlers = (key: keyof TasteRatings) =>
        createSliderHandlers(updateTasteRating(key), 0, 5, 1);

    // 计算水量
    const calculateWater = useCallback((coffee: string, ratio: string): string => {
        const coffeeValue = parseFloat(coffee.match(/(\d+(\.\d+)?)/)?.[0] || '0');
        const ratioValue = parseFloat(ratio.match(/1:(\d+(\.\d+)?)/)?.[1] || '0');
        return (coffeeValue > 0 && ratioValue > 0) ? `${Math.round(coffeeValue * ratioValue)}g` : methodParams.water;
    }, [methodParams.water]);

    // 通用数值输入处理
    const createNumericHandler = useCallback((
        field: 'coffee' | 'ratio' | 'temp',
        formatter: (value: string) => string
    ) => (value: string) => {
        if (!validateNumericInput(value)) return;

        setNumericValues(prev => ({ ...prev, [field]: value }));

        const formattedValue = formatter(value);
        setMethodParams(prev => {
            const newParams = { ...prev, [field]: formattedValue };
            if (field === 'coffee' || field === 'ratio') {
                newParams.water = calculateWater(
                    field === 'coffee' ? formattedValue : prev.coffee,
                    field === 'ratio' ? formattedValue : prev.ratio
                );
            }
            return newParams;
        });
    }, [calculateWater]);

    const handleCoffeeChange = createNumericHandler('coffee', (value) => value ? `${value}g` : '');
    const handleRatioChange = createNumericHandler('ratio', (value) => value ? `1:${value}` : DEFAULT_METHOD_PARAMS.ratio);
    const handleTempChange = createNumericHandler('temp', (value) => value ? `${value}°C` : '');

    // 处理器具选择
    const handleEquipmentSelect = useCallback(async (equipmentId: string) => {
        try {
            setSelectedEquipment(equipmentId);
            const equipmentMethods = customMethods[equipmentId] || [];
            // 使用新的辅助函数获取通用方案
            const commonEquipmentMethods = getCommonMethodsForEquipment(equipmentId, availableEquipments);
            const allMethods = [...equipmentMethods, ...commonEquipmentMethods];
            setAvailableMethods(allMethods);

            if (allMethods.length > 0) {
                const firstMethod = allMethods[0];
                const methodIdentifier = firstMethod.name || firstMethod.id || '';
                setSelectedMethod(methodIdentifier);
                updateMethodParams(firstMethod.params);
            } else {
                setSelectedMethod('');
            }
            setShowEquipmentMethodSelector(false);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error('选择器具失败:', error);
            }
        }
    }, [customMethods, updateMethodParams, availableEquipments]);

    // 处理方案选择
    const handleMethodSelect = useCallback((methodIdentifier: string) => {
        try {
            const selectedMethodObj = availableMethods.find(m =>
                m.name === methodIdentifier || m.id === methodIdentifier
            );
            if (selectedMethodObj) {
                const methodToStore = selectedMethodObj.name || selectedMethodObj.id || '';
                setSelectedMethod(methodToStore);
                updateMethodParams(selectedMethodObj.params);
            }
            setShowEquipmentMethodSelector(false);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error('选择方案失败:', error);
            }
        }
    }, [availableMethods, updateMethodParams]);

    // 获取当前器具和方案名称 - 使用useMemo优化
    const currentEquipmentName = useMemo(() => {
        const equipment = availableEquipments.find(eq => eq.id === selectedEquipment);
        return equipment?.name || selectedEquipment || '未知器具';
    }, [availableEquipments, selectedEquipment]);

    const currentMethodName = useMemo(() => {
        const method = availableMethods.find(m =>
            m.name === selectedMethod || m.id === selectedMethod
        );
        return method?.name || selectedMethod || '未知方案';
    }, [availableMethods, selectedMethod]);

    // Inside the component, add a new state for showing/hiding flavor ratings
    const [showFlavorRatings, setShowFlavorRatings] = useState(() => {
        // 初始化时检查是否有任何风味评分大于0
        const hasTasteValues = initialData?.taste && (
            (initialData.taste.acidity > 0) || 
            (initialData.taste.sweetness > 0) || 
            (initialData.taste.bitterness > 0) || 
            (initialData.taste.body > 0)
        );
        
        // 如果有风味评分，默认展开
        return hasTasteValues || false;
    });
    
    // 监听风味评分变化
    useEffect(() => {
        // 检查任何风味评分是否大于0
        const hasTasteValues = 
            formData.taste.acidity > 0 || 
            formData.taste.sweetness > 0 || 
            formData.taste.bitterness > 0 || 
            formData.taste.body > 0;
        
        // 如果有任何风味评分大于0，自动展开风味评分区域
        if (hasTasteValues && !showFlavorRatings) {
            setShowFlavorRatings(true);
        }
    }, [formData.taste, showFlavorRatings]);

    // 处理图片上传和选择
    const handleImageUpload = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const base64 = reader.result as string;
                if (!base64) return;
                const compressedBase64 = await compressBase64Image(base64, {
                    maxSizeMB: 0.1,
                    maxWidthOrHeight: 1200,
                    initialQuality: 0.8
                });
                setFormData(prev => ({ ...prev, image: compressedBase64 }));
            } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('图片处理失败:', error);
                }
            }
        };
        reader.onerror = () => {
            if (process.env.NODE_ENV === 'development') {
                console.error('文件读取失败');
            }
        };
        reader.readAsDataURL(file);
    }, []);

    const handleImageSelect = useCallback(async (source: 'camera' | 'gallery') => {
        try {
            const result = await captureImage({ source });
            const response = await fetch(result.dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `image.${result.format}`, { type: `image/${result.format}` });
            handleImageUpload(file);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error('打开相机/相册失败:', error);
            }
        }
    }, [handleImageUpload]);

    // 处理咖啡豆选择变化
    const handleCoffeeBeanSelect = useCallback((bean: CoffeeBean | null) => {
        setSelectedCoffeeBean(bean);
        setShowCoffeeBeanSelector(false);
        setCoffeeBeanSearchQuery(''); // 清空搜索

        // 更新表单中的咖啡豆信息
        if (bean) {
            setFormData(prev => ({
                ...prev,
                coffeeBeanInfo: {
                    name: bean.name || '',
                    roastLevel: normalizeRoastLevel(bean.roastLevel),
                    roastDate: bean.roastDate || ''
                }
            }));
        } else {
            // 如果取消选择咖啡豆，清空咖啡豆信息
            setFormData(prev => ({
                ...prev,
                coffeeBeanInfo: {
                    name: '',
                    roastLevel: '中度烘焙',
                    roastDate: ''
                }
            }));
        }
    }, []);

    // 保存笔记的处理函数
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // 处理咖啡豆变化和容量同步（容量调整记录除外）
        if (initialData.id && initialData.source !== 'capacity-adjustment') {
            try {
                const { CapacitySyncManager, CoffeeBeanManager } = await import('@/lib/managers/coffeeBeanManager');
                const currentCoffeeAmount = CapacitySyncManager.extractCoffeeAmount(methodParams.coffee);

                // 检查咖啡豆是否发生变化
                const currentBeanId = selectedCoffeeBean?.id;
                const beanChanged = originalBeanId !== currentBeanId;

                if (beanChanged) {
                    // 咖啡豆发生变化，需要处理双向容量同步
                    const originalCoffeeAmount = CapacitySyncManager.extractCoffeeAmount(initialData.params?.coffee || '0g');

                    // 恢复原咖啡豆的剩余量（如果原来有关联的咖啡豆）
                    if (originalBeanId && originalCoffeeAmount > 0) {
                        await CoffeeBeanManager.increaseBeanRemaining(originalBeanId, originalCoffeeAmount);
                    }

                    // 扣除新咖啡豆的剩余量（如果选择了新的咖啡豆）
                    if (currentBeanId && currentCoffeeAmount > 0) {
                        await CoffeeBeanManager.updateBeanRemaining(currentBeanId, currentCoffeeAmount);
                    }
                } else if (originalBeanId) {
                    // 咖啡豆没有变化，但可能咖啡用量发生了变化
                    const oldCoffeeAmount = CapacitySyncManager.extractCoffeeAmount(initialData.params?.coffee || '0g');
                    const amountDiff = currentCoffeeAmount - oldCoffeeAmount;

                    if (Math.abs(amountDiff) > 0.01) {
                        if (amountDiff > 0) {
                            await CoffeeBeanManager.updateBeanRemaining(originalBeanId, amountDiff);
                        } else {
                            await CoffeeBeanManager.increaseBeanRemaining(originalBeanId, Math.abs(amountDiff));
                        }
                    }
                }
            } catch (error) {
                console.error('同步咖啡豆容量失败:', error);
            }
        }

        // 创建完整的笔记数据
        const noteData: BrewingNoteData = {
            id: id || Date.now().toString(),
            // 使用当前的时间戳状态
            timestamp: timestamp.getTime(),
            ...formData,
            equipment: selectedEquipment || initialData.equipment,
            method: selectedMethod || initialData.method,
            params: {
                // 使用当前的方案参数
                coffee: methodParams.coffee,
                water: methodParams.water,
                ratio: methodParams.ratio,
                grindSize: methodParams.grindSize,
                temp: methodParams.temp
            },
            totalTime: initialData.totalTime,
            // 使用当前选中的咖啡豆ID
            beanId: selectedCoffeeBean?.id,
            // 保留容量调整记录的特殊属性
            ...(initialData.source === 'capacity-adjustment' ? {
                source: initialData.source,
                changeRecord: initialData.changeRecord
            } : {}),
            // 保留快捷扣除记录的特殊属性
            ...(initialData.source === 'quick-decrement' ? {
                source: initialData.source,
                quickDecrementAmount: initialData.quickDecrementAmount
            } : {})
        };

        try {
            // 保存笔记
            onSave(noteData);

            // 如果提供了保存成功的回调，则调用它
            if (onSaveSuccess) {
                onSaveSuccess();
            }
        } catch (error) {
            // Log error in development only
            if (process.env.NODE_ENV === 'development') {
                console.error('保存笔记时出错:', error);
            }
            alert('保存笔记时出错，请重试');
        }
    }

    if (!isOpen) return null

    // 动态设置容器 padding，在冲煮页面时不需要额外 padding
    // 当hideHeader为true时，添加足够的顶部边距，确保表单内容不会位于导航栏下面
    const containerClassName = `relative flex flex-col ${!inBrewPage ? 'p-6 pt-6' : ''} ${hideHeader ? 'pt-6' : ''} h-full overflow-y-auto overscroll-contain`;

    return (
        <form 
            id={id} 
            ref={formRef}
            onSubmit={handleSubmit}
            className={containerClassName}
        >
            {/* 根据hideHeader属性决定是否显示头部 */}
            {!hideHeader && (
                <div className="shrink-0 mb-4">
                    <NoteFormHeader
                        isEditMode={!!initialData?.id}
                        onBack={onClose}
                        onSave={() => formRef.current?.requestSubmit()}
                        showSaveButton={showSaveButton}
                        timestamp={timestamp}
                        onTimestampChange={handleTimestampChange}
                    />
                </div>
            )}

            {/* Form content - 更新内容区域样式以确保正确滚动 */}
            <div className="grow space-y-6 pb-20">
                {/* 咖啡豆信息 */}
                <div className="space-y-4">
                    <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400 mb-3">
                        {(selectedCoffeeBean || (initialData.id && formData.coffeeBeanInfo.name)) ? (
                            // 显示选择的咖啡豆信息，只在咖啡豆名称部分添加下划线
                            <>
                                <span>咖啡豆信息 ·</span>
                                {initialData.id && coffeeBeans.length > 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowCoffeeBeanSelector(!showCoffeeBeanSelector);
                                            if (!showCoffeeBeanSelector) {
                                                setCoffeeBeanSearchQuery(''); // 打开时清空搜索
                                            }
                                        }}
                                        className="ml-1 text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400 border-b border-dashed border-neutral-400 dark:border-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-neutral-600 dark:hover:border-neutral-400 transition-colors cursor-pointer"
                                    >
                                        {selectedCoffeeBean?.name || formData.coffeeBeanInfo.name || '未知咖啡豆'}
                                    </button>
                                ) : (
                                    <span className="ml-1">{selectedCoffeeBean?.name || formData.coffeeBeanInfo.name || '未知咖啡豆'}</span>
                                )}
                            </>
                        ) : (
                            // 只显示标题
                            '咖啡豆信息'
                        )}
                    </div>

                    {/* 咖啡豆选择器 - 直接在咖啡豆信息下面 */}
                    {initialData.id && coffeeBeans.length > 0 && showCoffeeBeanSelector && (
                        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900">
                            {/* 搜索框 */}
                            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
                                <input
                                    type="text"
                                    value={coffeeBeanSearchQuery}
                                    onChange={(e) => setCoffeeBeanSearchQuery(e.target.value)}
                                    placeholder="搜索咖啡豆..."
                                    className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                                />
                            </div>
                            {/* 选择器内容 */}
                            <div className="max-h-80 overflow-y-auto px-3">
                                <CoffeeBeanSelector
                                    coffeeBeans={coffeeBeans}
                                    selectedCoffeeBean={selectedCoffeeBean}
                                    onSelect={handleCoffeeBeanSelect}
                                    searchQuery={coffeeBeanSearchQuery}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* 笔记图片 */}
                <div className="space-y-2 w-full">
                    <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400 mb-3">
                        笔记图片
                    </div>
                    <div className="flex items-center justify-center relative">
                        <div className="w-32 h-32 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center overflow-hidden relative">
                            {formData.image ? (
                                <div className="relative w-full h-full">
                                    <Image
                                        src={formData.image}
                                        alt="笔记图片"
                                        className="object-contain"
                                        fill
                                        sizes="(max-width: 768px) 100vw, 300px"
                                    />
                                    {/* 操作按钮组 */}
                                    <div className="absolute top-1 right-1 flex space-x-1">
                                        {/* 删除按钮 */}
                                        <button
                                            type="button"
                                            className="w-6 h-6 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 rounded-full flex items-center justify-center shadow-md hover:bg-red-500 dark:hover:bg-red-500 dark:hover:text-white transition-colors z-10"
                                            onClick={() => setFormData(prev => ({...prev, image: ''}))}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-between h-full w-full">
                                    <div className="flex-1 flex flex-col items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-neutral-400 dark:text-neutral-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-400">选择图片</span>
                                        <span className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1">200kb以上将自动压缩</span>
                                    </div>
                                    
                                    {/* 图片上传按钮组 */}
                                    <div className="flex w-full mt-auto">
                                        <button
                                            type="button"
                                            onClick={() => handleImageSelect('camera')}
                                            className="flex-1 py-1 text-xs text-neutral-600 dark:text-neutral-400 border-t-2 border-r-2 border-dashed border-neutral-300 dark:border-neutral-700"
                                        >
                                            <span className="flex items-center justify-center">
                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                拍照
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleImageSelect('gallery')}
                                            className="flex-1 py-1 text-xs text-neutral-600 dark:text-neutral-400 border-t-2 border-dashed border-neutral-300 dark:border-neutral-700"
                                        >
                                            <span className="flex items-center justify-center">
                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                相册
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 咖啡豆信息 */}
                <div className="space-y-4">
                    {/* 只有在新建笔记且没有选择咖啡豆时才显示输入框 */}
                    {!initialData.coffeeBean && !initialData.id && (
                        <div className="grid gap-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <input
                                        type="text"
                                        value={formData.coffeeBeanInfo.name}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                coffeeBeanInfo: {
                                                    ...formData.coffeeBeanInfo,
                                                    name: e.target.value,
                                                },
                                            })
                                        }
                                        className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                        placeholder="咖啡豆名称"
                                    />
                                </div>
                                <div>
                                    <Select
                                        value={formData.coffeeBeanInfo.roastLevel}
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                coffeeBeanInfo: {
                                                    ...formData.coffeeBeanInfo,
                                                    roastLevel: value,
                                                },
                                            })
                                        }
                                    >
                                        <SelectTrigger
                                            className="w-full py-2 bg-transparent border-0 border-b border-neutral-200 dark:border-neutral-800 focus-within:border-neutral-400 dark:focus-within:border-neutral-600 shadow-none rounded-none h-auto px-0 text-xs"
                                        >
                                            <SelectValue placeholder="选择烘焙度" />
                                        </SelectTrigger>
                                        <SelectContent
                                            className="max-h-[40vh] overflow-y-auto border-neutral-200/70 dark:border-neutral-800/70 shadow-lg backdrop-blur-xs bg-white/95 dark:bg-neutral-900/95 rounded-lg"
                                        >
                                            {ROAST_LEVELS.map(level => (
                                                <SelectItem key={level} value={level}>{level}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 添加方案参数编辑 - 只在编辑记录时显示 */}
                {initialData?.id && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between" data-equipment-method-selector>
                        <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400 flex-1 min-w-0 mr-3">
                            <span className="truncate block">
                                方案参数 · {currentEquipmentName}_{currentMethodName}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowEquipmentMethodSelector(!showEquipmentMethodSelector)}
                            className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400 underline hover:text-neutral-700 dark:hover:text-neutral-300 flex-shrink-0"
                        >
                            [ 选择 ]
                        </button>
                    </div>

                    {/* 器具和方案选择下拉框 */}
                    {showEquipmentMethodSelector && (
                        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 space-y-4 bg-neutral-50 dark:bg-neutral-900" data-equipment-method-selector>
                            {/* 器具选择 */}
                            <div className="space-y-2">
                                <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                    选择器具
                                </div>
                                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                                    {availableEquipments.map((equipment) => (
                                        <button
                                            key={equipment.id}
                                            type="button"
                                            onClick={() => handleEquipmentSelect(equipment.id)}
                                            className={`text-xs p-2 rounded border text-left ${
                                                selectedEquipment === equipment.id
                                                    ? 'border-neutral-800 dark:border-white bg-neutral-100 dark:bg-neutral-800'
                                                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500'
                                            }`}
                                        >
                                            {equipment.name}
                                            {'isCustom' in equipment && equipment.isCustom && (
                                                <span className="ml-1 text-neutral-400 dark:text-neutral-500">(自定义)</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 方案选择 */}
                            {availableMethods.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                        选择方案
                                    </div>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {availableMethods.map((method) => {
                                            // 优先使用名称作为标识符
                                            const methodIdentifier = method.name || method.id || '';
                                            return (
                                                <button
                                                    key={method.id || method.name}
                                                    type="button"
                                                    onClick={() => handleMethodSelect(methodIdentifier)}
                                                    className={`w-full text-xs p-2 rounded border text-left ${
                                                        selectedMethod === methodIdentifier
                                                            ? 'border-neutral-800 dark:border-white bg-neutral-100 dark:bg-neutral-800'
                                                            : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500'
                                                    }`}
                                                >
                                                    {method.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="grid grid-cols-4 gap-6">
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={numericValues.coffee}
                                onChange={(e) => handleCoffeeChange(e.target.value)}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none pr-4"
                                placeholder="15"
                            />
                            <span className="absolute right-0 bottom-2 text-xs text-neutral-400 dark:text-neutral-500">g</span>
                        </div>
                        <div className="relative overflow-hidden">
                            <div className="flex items-center">
                                <span className="text-xs text-neutral-400 dark:text-neutral-500 mr-1 flex-shrink-0">1:</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={numericValues.ratio}
                                    onChange={(e) => handleRatioChange(e.target.value)}
                                    className="flex-1 min-w-0 border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                    placeholder="15"
                                />
                            </div>
                        </div>
                        <div>
                            <input
                                type="text"
                                value={settings ? formatGrindSize(methodParams.grindSize, settings.grindType) : methodParams.grindSize}
                                onChange={(e) => setMethodParams({...methodParams, grindSize: e.target.value})}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                placeholder={settings && hasSpecificGrindScale(settings.grindType) ? `8${getGrindScaleUnit(settings.grindType)}` : '中细'}
                            />
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={numericValues.temp}
                                onChange={(e) => handleTempChange(e.target.value)}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none pr-8"
                                placeholder="92"
                            />
                            <span className="absolute right-0 bottom-2 text-xs text-neutral-400 dark:text-neutral-500">°C</span>
                        </div>
                    </div>
                </div>
                )}

                {/* 风味评分 */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-medium  tracking-widest text-neutral-500 dark:text-neutral-400">
                            风味评分
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowFlavorRatings(!showFlavorRatings)}
                            className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400"
                        >
                            [ {showFlavorRatings ? '收起' : '展开'} ]
                        </button>
                    </div>
                    
                    {showFlavorRatings && (
                        <div className="grid grid-cols-2 gap-8">
                            {Object.entries(formData.taste).map(([key, value]) => (
                                <div key={key} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                            {TASTE_LABELS[key as keyof typeof TASTE_LABELS]}
                                        </div>
                                        <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                                            [ {value || 0} ]
                                        </div>
                                    </div>
                                    <div className="relative py-4 -my-4">
                                        <input
                                            type="range"
                                            min="0"
                                            max="5"
                                            step="1"
                                            value={value || 0}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    taste: {
                                                        ...formData.taste,
                                                        [key]: parseInt(e.target.value),
                                                    },
                                                })
                                            }
                                            onTouchStart={tasteHandlers(key as keyof TasteRatings).onTouchStart(value)}
                                            onTouchMove={tasteHandlers(key as keyof TasteRatings).onTouchMove}
                                            onTouchEnd={tasteHandlers(key as keyof TasteRatings).onTouchEnd}
                                            className={SLIDER_STYLES}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 总体评分 */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-medium  tracking-widest text-neutral-500 dark:text-neutral-400">
                            总体评分
                        </div>
                        <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                            [ {formData.rating.toFixed(1)} ]
                        </div>
                    </div>
                    <div className="relative py-3">
                        <div className="relative py-4 -my-4">
                            <input
                                type="range"
                                min="1"
                                max="5"
                                step="0.5"
                                value={formData.rating}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        rating: parseFloat(e.target.value),
                                    })
                                }
                                onTouchStart={ratingHandlers.onTouchStart(formData.rating)}
                                onTouchMove={ratingHandlers.onTouchMove}
                                onTouchEnd={ratingHandlers.onTouchEnd}
                                className={SLIDER_STYLES}
                            />
                        </div>
                    </div>
                </div>

                {/* 笔记 */}
                <div className="space-y-4">
                    <div className="text-xs font-medium  tracking-widest text-neutral-500 dark:text-neutral-400">
                        笔记
                    </div>
                    <AutoResizeTextarea
                        value={formData.notes}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                notes: e.target.value,
                            })
                        }
                        className="text-xs font-medium border-b border-neutral-200 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 pb-4"
                        placeholder="记录一下这次冲煮的感受、改进点等..."
                        minRows={3}
                        maxRows={10}
                    />
                </div>
            </div>
        </form>
    )
}

export default BrewingNoteForm 