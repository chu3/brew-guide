'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

import type { BrewingNoteData, CoffeeBean } from '@/types/app'
import AutoResizeTextarea from '@/components/common/forms/AutoResizeTextarea'
import NoteFormHeader from '@/components/notes/ui/NoteFormHeader'

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
}

// 图片压缩函数
const compressBase64 = (base64: string, quality = 0.7, maxWidth = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 如果图片小于200kb，直接返回原图
    if (base64.length * 0.75 <= 200 * 1024) {
      resolve(base64);
      return;
    }

    const img = document.createElement('img');
    const timeout = setTimeout(() => reject(new Error('图片加载超时')), 10000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        let { width, height } = img;
        if (width > maxWidth) {
          height = height * (maxWidth / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error('无法获取canvas上下文');

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('图片加载失败'));
    };

    img.src = base64;
  });
};

// 标准化烘焙度值 - 现在接受翻译函数作为参数
const normalizeRoastLevel = (roastLevel?: string, t?: any): string => {
    const defaultRoast = t ? t('roastLevels.medium') : 'medium';

    if (!roastLevel) return defaultRoast;
    if (roastLevel.endsWith('烘焙') || roastLevel.endsWith('Light') || roastLevel.endsWith('Dark')) return roastLevel;

    // 如果有翻译函数，使用翻译后的值
    if (t) {
        const roastMap: Record<string, string> = {
            '极浅': t('roastLevels.lightPlus'),
            '浅度': t('roastLevels.light'),
            '中浅': t('roastLevels.mediumLight'),
            '中度': t('roastLevels.medium'),
            '中深': t('roastLevels.mediumDark'),
            '深度': t('roastLevels.dark'),
            'Light+': t('roastLevels.lightPlus'),
            'Light': t('roastLevels.light'),
            'Medium Light': t('roastLevels.mediumLight'),
            'Medium': t('roastLevels.medium'),
            'Medium Dark': t('roastLevels.mediumDark'),
            'Dark': t('roastLevels.dark')
        };

        // 直接匹配或包含匹配
        return roastMap[roastLevel] ||
               Object.entries(roastMap).find(([key]) => roastLevel.includes(key))?.[1] ||
               defaultRoast;
    }

    // 回退到中文映射
    const roastMap: Record<string, string> = {
        '极浅': '极浅烘焙',
        '浅度': '浅度烘焙',
        '中浅': '中浅烘焙',
        '中度': '中度烘焙',
        '中深': '中深烘焙',
        '深度': '深度烘焙'
    };

    return roastMap[roastLevel] ||
           Object.entries(roastMap).find(([key]) => roastLevel.includes(key))?.[1] ||
           defaultRoast;
};

// 获取初始咖啡豆信息 - 现在接受翻译函数作为参数
const getInitialCoffeeBeanInfo = (initialData: BrewingNoteFormProps['initialData'], t?: any) => {
    const beanInfo = initialData.coffeeBean || initialData.coffeeBeanInfo;
    return {
        name: beanInfo?.name || '',
        roastLevel: normalizeRoastLevel(beanInfo?.roastLevel, t)
    };
};

// 通用滑块样式
const SLIDER_STYLES = `relative h-px w-full appearance-none bg-neutral-300 dark:bg-neutral-600 cursor-pointer touch-none
[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-solid
[&::-webkit-slider-thumb]:border-neutral-300 [&::-webkit-slider-thumb]:bg-neutral-50
dark:[&::-webkit-slider-thumb]:border-neutral-600 dark:[&::-webkit-slider-thumb]:bg-neutral-900
[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none
[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-solid
[&::-moz-range-thumb]:border-neutral-300 [&::-moz-range-thumb]:bg-neutral-50
dark:[&::-moz-range-thumb]:border-neutral-600 dark:[&::-moz-range-thumb]:bg-neutral-900`;

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
}) => {
    const t = useTranslations('notes.form')

    const [formData, setFormData] = useState<FormData>({
        coffeeBeanInfo: getInitialCoffeeBeanInfo(initialData, t),
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
    
    // 添加方案参数状态
    const [methodParams, setMethodParams] = useState({
        coffee: initialData?.params?.coffee || '15g',
        water: initialData?.params?.water || '225g',
        ratio: initialData?.params?.ratio || '1:15',
        grindSize: initialData?.params?.grindSize || '中细',
        temp: initialData?.params?.temp || '92°C',
    });
    
    const formRef = useRef<HTMLFormElement>(null);
    const [currentSliderValue, setCurrentSliderValue] = useState<number | null>(null);

    // 通用滑块触摸处理
    const createSliderHandlers = (
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
    });
    
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

        document.addEventListener('touchend', handleGlobalTouchEnd);
        document.addEventListener('methodParamsChanged', handleMethodParamsChange as EventListener);

        return () => {
            document.removeEventListener('touchend', handleGlobalTouchEnd);
            document.removeEventListener('methodParamsChanged', handleMethodParamsChange as EventListener);
        };
    }, []);

    // 使用useRef保存上一次的initialData，用于比较变化
    const prevInitialDataRef = useRef<typeof initialData>(initialData);
    
    // Update form data when initialData changes
    useEffect(() => {
        // 检查咖啡豆信息变化
        const prevCoffeeBean = prevInitialDataRef.current.coffeeBean;
        const currentCoffeeBean = initialData.coffeeBean;
        
        const hasCoffeeBeanChanged = 
            (prevCoffeeBean?.id !== currentCoffeeBean?.id) || 
            (prevCoffeeBean?.name !== currentCoffeeBean?.name) ||
            (!prevCoffeeBean && currentCoffeeBean) ||
            (prevCoffeeBean && !currentCoffeeBean);
            
        const prevCoffeeBeanInfo = prevInitialDataRef.current.coffeeBeanInfo;
        const currentCoffeeBeanInfo = initialData.coffeeBeanInfo;
        
        const hasCoffeeBeanInfoChanged = 
            (prevCoffeeBeanInfo?.name !== currentCoffeeBeanInfo?.name) ||
            (prevCoffeeBeanInfo?.roastLevel !== currentCoffeeBeanInfo?.roastLevel) ||
            (!prevCoffeeBeanInfo && currentCoffeeBeanInfo) ||
            (prevCoffeeBeanInfo && !currentCoffeeBeanInfo);
            
        // 只有当咖啡豆信息真的变化时，才更新表单数据
        if (hasCoffeeBeanChanged || hasCoffeeBeanInfoChanged) {
            const updatedCoffeeBeanInfo = currentCoffeeBean
                ? {
                    name: currentCoffeeBean.name || '',
                    roastLevel: normalizeRoastLevel(currentCoffeeBean.roastLevel || t('roastLevels.medium'), t),
                }
                : currentCoffeeBeanInfo
                    ? {
                        name: currentCoffeeBeanInfo.name || '',
                        roastLevel: normalizeRoastLevel(currentCoffeeBeanInfo.roastLevel || t('roastLevels.medium'), t),
                    }
                    : {
                        name: '',
                        roastLevel: t('roastLevels.medium')
                    };
            
            setFormData(prev => ({
                ...prev,
                coffeeBeanInfo: updatedCoffeeBeanInfo
            }));
        }
        
        // 检查其他字段变化
        const hasOtherDataChanged = 
            (prevInitialDataRef.current.rating !== initialData.rating) ||
            (prevInitialDataRef.current.notes !== initialData.notes) ||
            (prevInitialDataRef.current.image !== initialData.image) ||
            JSON.stringify(prevInitialDataRef.current.taste) !== JSON.stringify(initialData.taste);
            
        if (hasOtherDataChanged) {
            setFormData(prev => ({
                ...prev,
                image: typeof initialData.image === 'string' ? initialData.image : prev.image,
                rating: initialData.rating || prev.rating,
                taste: {
                    acidity: initialData.taste?.acidity ?? prev.taste.acidity,
                    sweetness: initialData.taste?.sweetness ?? prev.taste.sweetness,
                    bitterness: initialData.taste?.bitterness ?? prev.taste.bitterness,
                    body: initialData.taste?.body ?? prev.taste.body
                },
                notes: initialData.notes || prev.notes
            }));
        }
        
        // 检查方法参数变化
        const hasParamsChanged = JSON.stringify(prevInitialDataRef.current.params) !== JSON.stringify(initialData.params);
        
        if (hasParamsChanged && initialData.params) {
            setMethodParams(initialData.params);
        }
        
        // 更新引用
        prevInitialDataRef.current = initialData;
    }, [initialData]);

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
    const calculateWater = (coffee: string, ratio: string): string => {
        const coffeeValue = parseFloat(coffee.match(/(\d+(\.\d+)?)/)?.[0] || '0');
        const ratioValue = parseFloat(ratio.match(/1:(\d+(\.\d+)?)/)?.[1] || '0');

        if (coffeeValue > 0 && ratioValue > 0) {
            return `${Math.round(coffeeValue * ratioValue)}g`;
        }
        return methodParams.water;
    };

    // 处理咖啡粉量变化
    const handleCoffeeChange = (value: string) => {
        setMethodParams(prev => ({
            ...prev,
            coffee: value,
            water: calculateWater(value, prev.ratio)
        }));
    };

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

    // 处理图片上传
    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();

        reader.onload = async () => {
            try {
                const base64 = reader.result as string;
                if (!base64) return;

                const compressedBase64 = await compressBase64(base64, 0.5, 800);
                setFormData(prev => ({ ...prev, image: compressedBase64 }));
            } catch (error) {
                console.error('图片处理失败:', error);
                // 降级使用原始文件
                const objectUrl = URL.createObjectURL(file);
                setFormData(prev => ({ ...prev, image: objectUrl }));
                setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
            }
        };

        reader.onerror = () => {
            console.error('文件读取失败');
            const objectUrl = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, image: objectUrl }));
            setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
        };

        reader.readAsDataURL(file);
    };
    
    // 处理图片选择
    const handleImageSelect = (source: 'camera' | 'gallery') => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';

        if (source === 'camera') {
            fileInput.setAttribute('capture', 'environment');
        }

        fileInput.onchange = (e) => {
            const input = e.target as HTMLInputElement;
            const file = input.files?.[0];
            if (file?.type.startsWith('image/')) {
                handleImageUpload(file);
            }
        };

        fileInput.click();
    };

    // 保存笔记的处理函数
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        // 创建完整的笔记数据
        const noteData: BrewingNoteData = {
            id: id || Date.now().toString(),
            // 编辑现有笔记时保留原始时间戳，新建笔记时使用当前时间
            timestamp: initialData.timestamp || Date.now(),
            ...formData,
            equipment: initialData.equipment,
            method: initialData.method,
            params: {
                // 优先使用MethodSelector中更新的参数，如果没有则使用初始参数，最后使用默认值
                coffee: methodParams.coffee || initialData.params?.coffee || '',
                water: methodParams.water || initialData.params?.water || '',
                ratio: methodParams.ratio || initialData.params?.ratio || '',
                grindSize: methodParams.grindSize || initialData.params?.grindSize || '',
                temp: methodParams.temp || initialData.params?.temp || ''
            },
            totalTime: initialData.totalTime,
            // 确保保留beanId，这是与咖啡豆的关联字段
            beanId: initialData.beanId
        };

        try {
            // 保存笔记
            onSave(noteData);
            
            // 如果提供了保存成功的回调，则调用它
            if (onSaveSuccess) {
                onSaveSuccess();
            }
        } catch (error) {
            console.error('保存笔记时出错:', error);
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
                    />
                </div>
            )}

            {/* Form content - 更新内容区域样式以确保正确滚动 */}
            <div className="grow space-y-6 pb-20">
                {/* 笔记图片 */}
                <div className="space-y-2 w-full">
                    <label className="block text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                        {t('fields.image')}
                    </label>
                    <div className="flex items-center justify-center relative">
                        <div className="w-32 h-32 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center overflow-hidden relative">
                            {formData.image ? (
                                <div className="relative w-full h-full">
                                    <Image
                                        src={formData.image}
                                        alt={t('fields.image')}
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
                                        <span className="text-xs text-neutral-500 dark:text-neutral-400">{t('placeholders.selectImage')}</span>
                                        <span className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1">{t('placeholders.imageCompress')}</span>
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
                                                {t('buttons.camera')}
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
                                                {t('buttons.gallery')}
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
                    <div className="text-xs font-medium  tracking-widest text-neutral-500 dark:text-neutral-400">
                        {initialData.coffeeBean ? (
                            // 显示选择的咖啡豆信息，直接在标题后面
                            <>{t('fields.beanInfo')} · {formData.coffeeBeanInfo.name || t('messages.unknownBean')}</>
                        ) : (
                            // 只显示标题
                            t('fields.beanInfo')
                        )}
                    </div>
                    {!initialData.coffeeBean && (
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
                                        placeholder={t('placeholders.beanName')}
                                    />
                                </div>
                                <div>
                                    <select
                                        value={formData.coffeeBeanInfo.roastLevel}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                coffeeBeanInfo: {
                                                    ...formData.coffeeBeanInfo,
                                                    roastLevel: e.target.value,
                                                },
                                            })
                                        }
                                        className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 text-neutral-800 dark:text-neutral-300"
                                    >
                                        <option value={t('roastLevels.lightPlus')}>{t('roastLevels.lightPlus')}</option>
                                        <option value={t('roastLevels.light')}>{t('roastLevels.light')}</option>
                                        <option value={t('roastLevels.mediumLight')}>{t('roastLevels.mediumLight')}</option>
                                        <option value={t('roastLevels.medium')}>{t('roastLevels.medium')}</option>
                                        <option value={t('roastLevels.mediumDark')}>{t('roastLevels.mediumDark')}</option>
                                        <option value={t('roastLevels.dark')}>{t('roastLevels.dark')}</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 添加方案参数编辑 - 只在编辑记录时显示 */}
                {initialData?.id && (
                <div className="space-y-4">
                    <div className="text-[10px] font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                        {t('fields.methodParams')}
                    </div>
                    <div className="grid grid-cols-4 gap-6">
                        <div>
                            <input
                                type="text"
                                value={methodParams.coffee}
                                onChange={(e) => handleCoffeeChange(e.target.value)}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                placeholder={t('placeholders.coffeeAmount')}
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                value={methodParams.ratio}
                                onChange={(e) => {
                                    const newRatio = e.target.value;
                                    setMethodParams(prev => ({
                                        ...prev,
                                        ratio: newRatio,
                                        water: calculateWater(prev.coffee, newRatio)
                                    }));
                                }}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                placeholder={t('placeholders.ratio')}
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                value={methodParams.grindSize}
                                onChange={(e) => setMethodParams({...methodParams, grindSize: e.target.value})}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                placeholder={t('placeholders.grindSize')}
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                value={methodParams.temp}
                                onChange={(e) => setMethodParams({...methodParams, temp: e.target.value})}
                                className="w-full border-b border-neutral-200 bg-transparent py-2 text-xs outline-hidden transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-600 text-neutral-800 dark:text-neutral-300 rounded-none"
                                placeholder={t('placeholders.temperature')}
                            />
                        </div>
                    </div>
                </div>
                )}

                {/* 风味评分 */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-medium  tracking-widest text-neutral-500 dark:text-neutral-400">
                            {t('fields.flavorRating')}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowFlavorRatings(!showFlavorRatings)}
                            className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400"
                        >
                            [ {showFlavorRatings ? t('buttons.collapse') : t('buttons.expand')} ]
                        </button>
                    </div>
                    
                    {showFlavorRatings && (
                        <div className="grid grid-cols-2 gap-8">
                            {Object.entries(formData.taste).map(([key, value]) => (
                                <div key={key} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-medium  tracking-widest text-neutral-500 dark:text-neutral-400">
                                            {t(`flavorAttributes.${key}` as any)}
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
                            {t('fields.overallRating')}
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
                        {t('fields.notes')}
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
                        placeholder={t('placeholders.notesText')}
                        minRows={3}
                        maxRows={10}
                    />
                </div>
            </div>
        </form>
    )
}

export default BrewingNoteForm 