'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { CoffeeBean } from '@/app/types'
import AutoResizeTextarea from './AutoResizeTextarea'
import AutocompleteInput from './AutocompleteInput'
// 移除Capacitor导入

interface CoffeeBeanFormProps {
    onSave: (bean: Omit<CoffeeBean, 'id' | 'timestamp'>) => void
    onCancel: () => void
    initialBean?: CoffeeBean
}

// 定义步骤类型
type Step = 'basic' | 'detail' | 'flavor' | 'complete'

// 预设选项
const ORIGINS = [
    '埃塞俄比亚',
    '巴西',
    '哥伦比亚',
    '危地马拉',
    '肯尼亚',
    '洪都拉斯',
    '哥斯达黎加',
    '秘鲁',
    '印度尼西亚',
    '牙买加',
    '也门',
    '越南',
    '墨西哥',
    '卢旺达',
    '坦桑尼亚',
    '巴拿马',
    '云南',
    '云南保山',
];


const PROCESSES = [
    '水洗',
    '日晒',
    '蜜处理',
    '半水洗',
    '黑蜜',
    '白蜜',
    '红蜜',
    '黄蜜',
    '厌氧发酵',
    '碳酸浸泡',
    '双重发酵',
    '干燥处理',
    '湿刷处理'
];

const VARIETIES = [
    '铁皮卡',
    '卡杜拉',
    '卡图拉',
    '波旁',
    '埃塞俄比亚传统品种',
    '瑰夏',
    '红波旁',
    '黄波旁',
    'SL28',
    'SL34',
    '西达摩',
    '卡蒂姆',
    '帕卡马拉',
    '卡斯蒂洛',
    '芒果',
    '卡杜艾',
    '芒多当新',
    '巴西天然种'
];

// 预设风味标签
const FLAVOR_TAGS = [
    // 水果类
    '柑橘', '橙子', '柠檬', '青柠', '葡萄柚', '橘子', '金橘',
    '热带水果', '菠萝', '芒果', '百香果', '木瓜', '荔枝', '龙眼',
    '浆果', '蓝莓', '草莓', '黑莓', '树莓', '蔓越莓', '红醋栗',
    '核果', '桃子', '杏子', '李子', '樱桃', '油桃', '蜜桃',
    '苹果', '梨子', '水梨', '香蕉', '西瓜', '哈密瓜', '鲜枣',
    '干果', '葡萄干', '无花果', '椰子', '榴莲',

    // 花香类
    '花香', '茉莉', '玫瑰', '紫罗兰', '洋甘菊', '橙花', '栀子花',
    '金银花', '薰衣草', '兰花', '牡丹', '桂花', '丁香', '香柏',

    // 甜味类
    '焦糖', '蜂蜜', '黑糖', '红糖', '枫糖', '太妃糖', '蔗糖',
    '巧克力', '牛奶巧克力', '黑巧克力', '白巧克力', '可可粉', '可可豆',
    '奶油', '奶酪', '炼乳', '香草', '蛋糕', '饼干', '布丁',
    '糖蜜', '棉花糖', '麦芽糖', '威化', '杏仁糖', '椰蓉',

    // 坚果类
    '坚果', '杏仁', '榛子', '核桃', '腰果', '花生', '松子',
    '开心果', '栗子', '夏威夷果', '巴西果', '碧根果', '瓜子',

    // 香料类
    '肉桂', '丁香', '豆蔻', '八角', '茴香', '花椒', '胡椒',
    '黑胡椒', '白胡椒', '姜', '肉豆蔻', '藏红花', '辣椒', '咖喱',

    // 草本类
    '草本', '薄荷', '罗勒', '香菜', '迷迭香', '百里香', '鼠尾草',
    '青草', '干草', '烘干草', '绿茶', '苔藓', '叶子', '野草',

    // 谷物/烘焙类
    '麦芽', '烤面包', '烤麦', '大麦', '燕麦', '烤杏仁', '烤榛子',
    '烤花生', '烘焙香', '烤坚果', '爆米花', '饼干', '华夫饼',

    // 酒类/发酵类
    '红酒', '白葡萄酒', '威士忌', '朗姆酒', '酒酿', '发酵',
    '啤酒花', '香槟', '波特酒', '雪莉酒', '白兰地', '伏特加',

    // 茶类
    '红茶', '伯爵茶', '茶香', '绿茶', '乌龙茶', '普洱', '抹茶',
    '茉莉茶', '菊花茶', '铁观音', '金骏眉', '大红袍',

    // 其他
    '木质', '菸草', '皮革', '松木', '杉木', '樟木', '檀木',
    '清新', '回甘', '明亮', '醇厚', '甘甜', '酸爽', '干净',
    '浓郁', '平衡', '复杂', '层次', '丝滑', '圆润', '顺滑',
    '活泼', '沉稳', '优雅', '野性', '馥郁', '醇香', '细腻',
    '轻盈', '厚重', '矿物质', '海盐', '烟熏', '焦糖化'
];

// 修改类型选项为单品和拼配
const BEAN_TYPES = [
    { value: '单品', label: '单品' },
    { value: '拼配', label: '拼配' },
];

// 风味分类
const FLAVOR_CATEGORIES = {
    '水果类': ['柑橘', '柠檬', '酸橙', '苹果', '葡萄', '蓝莓', '草莓', '樱桃', '桃子', '杏子', '菠萝', '热带水果', '红酒'],
    '花香类': ['茉莉', '玫瑰', '紫罗兰', '橙花', '薰衣草', '洋甘菊'],
    '甜味类': ['焦糖', '太妃糖', '蜂蜜', '红糖', '黑糖', '可可', '巧克力', '麦芽糖'],
    '坚果类': ['杏仁', '榛子', '核桃', '花生', '腰果', '开心果'],
    '香料类': ['肉桂', '丁香', '豆蔻', '胡椒', '姜'],
    '谷物/烘焙类': ['烤面包', '饼干', '谷物', '麦片', '麦芽', '烤核桃'],
    '茶类': ['红茶', '绿茶', '花茶', '白茶'],
    '其他': ['矿物质', '海盐', '烟熏', '焦糖化', '清爽', '醇厚']
};

const CoffeeBeanForm: React.FC<CoffeeBeanFormProps> = ({
    onSave,
    onCancel,
    initialBean,
}) => {
    // 当前步骤状态
    const [currentStep, setCurrentStep] = useState<Step>('basic')
    const inputRef = useRef<HTMLInputElement>(null)

    // 添加一个状态来跟踪正在编辑的剩余容量输入
    const [editingRemaining, setEditingRemaining] = useState<string | null>(null);

    const [bean, setBean] = useState<Omit<CoffeeBean, 'id' | 'timestamp'>>(() => {
        // 如果有初始豆子数据，直接使用
        if (initialBean) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, timestamp, ...beanData } = initialBean;
            return beanData;
        }

        // 否则创建新的豆子数据
        const newBean = {
            name: '',
            capacity: '',
            remaining: '',
            roastLevel: '浅度烘焙',
            roastDate: '',
            flavor: [],
            origin: '',
            process: '',
            variety: '',
            price: '',
            type: '单品',
            notes: '',
        };
        return newBean;
    });

    // 定义额外的状态来跟踪风味标签输入
    const [flavorInput, setFlavorInput] = useState('');

    // 自动聚焦输入框
    useEffect(() => {
        if (currentStep === 'basic' && inputRef.current) {
            inputRef.current.focus();
        }
    }, [currentStep]);

    // 开发调试用，强制确保表单可用
    useEffect(() => {
        // 移除控制台输出
    }, [bean]);

    // 自动填充功能：检查名称中是否包含预设的产地、处理法、品种
    const autoFillDetails = (name: string) => {
        // 转为小写进行比较
        const lowerName = name.toLowerCase();
        let updatedFields = {};

        // 检查产地 - 仅当未设置时才填充
        if (!bean.origin) {
            for (const origin of ORIGINS) {
                if (lowerName.includes(origin.toLowerCase())) {
                    updatedFields = { ...updatedFields, origin };
                    break;
                }
            }
        }

        // 检查处理法 - 仅当未设置时才填充
        if (!bean.process) {
            for (const process of PROCESSES) {
                if (lowerName.includes(process.toLowerCase())) {
                    updatedFields = { ...updatedFields, process };
                    break;
                }
            }
        }

        // 检查品种 - 仅当未设置时才填充
        if (!bean.variety) {
            for (const variety of VARIETIES) {
                if (lowerName.includes(variety.toLowerCase())) {
                    updatedFields = { ...updatedFields, variety };
                    break;
                }
            }
        }

        // 更新匹配到的字段
        if (Object.keys(updatedFields).length > 0) {
            setBean(prev => ({
                ...prev,
                ...updatedFields
            }));
        }
    };

    // 步骤配置
    const steps: { id: Step; label: string }[] = [
        { id: 'basic', label: '基本信息' },
        { id: 'detail', label: '详细信息' },
        { id: 'flavor', label: '风味描述' },
        { id: 'complete', label: '完成' }
    ];

    // 获取当前步骤索引
    const getCurrentStepIndex = () => {
        return steps.findIndex(step => step.id === currentStep);
    };

    // 验证剩余容量，确保不超过总容量（失焦时再次验证）
    const validateRemaining = useCallback(() => {
        // 清除编辑状态
        setEditingRemaining(null);

        // 如果已经设置了总容量和剩余容量
        if (bean.capacity && bean.remaining) {
            const capacityNum = parseInt(bean.capacity);
            const remainingNum = parseInt(bean.remaining);

            // 如果剩余容量大于总容量，将其重置为总容量
            if (!isNaN(capacityNum) && !isNaN(remainingNum) && remainingNum > capacityNum) {
                setBean(prev => ({
                    ...prev,
                    remaining: bean.capacity
                }));
            }
        }
    }, [bean.capacity, bean.remaining, setBean, setEditingRemaining]);

    // 下一步
    const handleNextStep = () => {
        // 先验证剩余容量
        validateRemaining();

        const currentIndex = getCurrentStepIndex();
        if (currentIndex < steps.length - 1) {
            setCurrentStep(steps[currentIndex + 1].id);
        } else {
            handleSubmit();
        }
    };

    // 上一步/返回
    const handleBack = () => {
        // 先验证剩余容量
        validateRemaining();

        const currentIndex = getCurrentStepIndex();
        if (currentIndex > 0) {
            setCurrentStep(steps[currentIndex - 1].id);
        } else {
            onCancel();
        }
    };

    // 添加风味标签
    const handleAddFlavor = () => {
        if (!flavorInput.trim()) return;

        // 如果标签已存在，不添加
        if (bean.flavor?.includes(flavorInput.trim())) {
            setFlavorInput('');
            return;
        }

        setBean({
            ...bean,
            flavor: [...(bean.flavor || []), flavorInput.trim()]
        });
        setFlavorInput('');
    };

    // 移除风味标签
    const handleRemoveFlavor = (flavor: string) => {
        setBean({
            ...bean,
            flavor: bean.flavor?.filter(f => f !== flavor) || []
        });
    };

    // 处理咖啡豆名称输入
    const handleNameChange = (value: string) => {
        setBean(prev => {
            const newBean = {
                ...prev,
                name: value || ''
            };
            return newBean;
        });

        // 当名称变更时，尝试自动填充其他字段
        if (value) {
            autoFillDetails(value);
        }
    };

    // 处理输入变化
    const handleInputChange = (field: keyof Omit<CoffeeBean, 'id' | 'timestamp' | 'flavor'>) => (value: string) => {
        // 强制转换为字符串并确保有值
        const safeValue = String(value || '');

        if (field === 'capacity') {
            // 确保容量是数字
            const numericValue = safeValue.replace(/[^0-9]/g, '');

            // 当更新容量时，同步更新剩余容量
            if (numericValue.trim() !== '') {
                setBean(prev => ({
                    ...prev,
                    capacity: numericValue,
                    remaining: numericValue // 同步更新剩余容量为相同值
                }));
                // 同时更新编辑状态
                setEditingRemaining(null);
            } else {
                // 如果容量为空，也设置剩余容量为空
                setBean(prev => ({
                    ...prev,
                    capacity: '',
                    remaining: ''
                }));
                // 同时更新编辑状态
                setEditingRemaining(null);
            }
        } else if (field === 'remaining') {
            // 确保剩余容量是数字
            const numericValue = safeValue.replace(/[^0-9]/g, '');

            // 更新编辑状态
            setEditingRemaining(numericValue);

            // 检查是否需要限制剩余容量
            if (bean.capacity && numericValue.trim() !== '') {
                const capacityNum = parseInt(bean.capacity);
                const remainingNum = parseInt(numericValue);

                if (!isNaN(capacityNum) && !isNaN(remainingNum)) {
                    // 如果剩余容量超过总容量，则只设置为总容量
                    if (remainingNum > capacityNum) {
                        setEditingRemaining(bean.capacity);
                        setBean(prev => ({
                            ...prev,
                            remaining: prev.capacity
                        }));
                        return;
                    }
                }
            }

            // 如果没有超出限制，正常更新
            setBean(prev => ({
                ...prev,
                remaining: numericValue
            }));
        } else {
            // 处理其他字段
            setBean(prev => ({
                ...prev,
                [field]: safeValue
            }));
        }
    };

    // 提交表单
    const handleSubmit = () => {
        // 再次验证剩余容量，确保数据正确
        validateRemaining();
        onSave(bean);
    };

    // 添加动画变体
    const pageVariants = {
        initial: {
            opacity: 0,
            x: 20,
            scale: 0.95,
        },
        in: {
            opacity: 1,
            x: 0,
            scale: 1,
        },
        out: {
            opacity: 0,
            x: -20,
            scale: 0.95,
        }
    };

    const pageTransition = {
        type: "tween",
        ease: "anticipate",
        duration: 0.26
    };

    // 渲染进度条
    const renderProgressBar = () => {
        const currentIndex = getCurrentStepIndex();
        const progress = ((currentIndex + 1) / steps.length) * 100;

        return (
            <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                    className="h-full bg-neutral-800 dark:bg-neutral-200 transition-all duration-300 ease-in-out"
                    style={{ width: `${progress}%` }}
                />
            </div>
        );
    };

    // 渲染步骤内容
    const renderStepContent = () => {
        switch (currentStep) {
            case 'basic':
                return (
                    <motion.div
                        key="basic-step"
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                        className="space-y-8 max-w-md mx-auto flex flex-col items-center justify-center h-full"
                    >
                        <div className="space-y-2 w-full">
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                咖啡豆名称 <span className="text-red-500">*</span>
                            </label>
                            <AutocompleteInput
                                value={bean.name || ''}
                                onChange={handleNameChange}
                                placeholder="输入咖啡豆名称"
                                suggestions={[]}
                                required
                                clearable
                                onBlur={() => {
                                    // 如果值为空，确保设置一个默认值
                                    if (!bean.name?.trim()) {
                                        setBean(prev => ({
                                            ...prev,
                                            name: '未命名咖啡豆'
                                        }));
                                    }
                                }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6 w-full">
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                    容量
                                </label>
                                <AutocompleteInput
                                    value={bean.capacity || ''}
                                    onChange={handleInputChange('capacity')}
                                    placeholder="例如：100"
                                    unit="g"
                                    clearable={false}
                                    suggestions={[]}
                                    inputType="tel"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                    剩余容量
                                </label>
                                <AutocompleteInput
                                    value={editingRemaining !== null ? editingRemaining : (bean.remaining || '')}
                                    onChange={handleInputChange('remaining')}
                                    placeholder="例如：100"
                                    unit="g"
                                    clearable={false}
                                    suggestions={[]}
                                    inputType="tel"
                                    onBlur={() => {
                                        // 强制再次验证，确保组件失焦时数据正确
                                        validateRemaining();
                                    }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 w-full">
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                    价格
                                </label>
                                <AutocompleteInput
                                    value={bean.price || ''}
                                    onChange={handleInputChange('price')}
                                    placeholder="例如：88"
                                    unit="¥"
                                    clearable={false}
                                    suggestions={[]}
                                    inputType="tel"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                    烘焙度
                                </label>
                                <select
                                    value={bean.roastLevel || '浅度烘焙'}
                                    onChange={(e) => setBean({ ...bean, roastLevel: e.target.value })}
                                    className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400 appearance-none"
                                >
                                    <option value="浅度烘焙">浅度烘焙</option>
                                    <option value="中浅烘焙">中浅烘焙</option>
                                    <option value="中度烘焙">中度烘焙</option>
                                    <option value="中深烘焙">中深烘焙</option>
                                    <option value="深度烘焙">深度烘焙</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2 w-full">
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                烘焙日期
                            </label>
                            <div className="relative w-full">
                                <input
                                    type="date"
                                    value={bean.roastDate || ''}
                                    onChange={(e) => {
                                        const newDate = e.target.value;
                                        setBean(prev => ({
                                            ...prev,
                                            roastDate: newDate
                                        }));
                                    }}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="absolute inset-0 opacity-0 w-full h-full z-10 cursor-pointer"
                                />
                                <div className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400 flex items-center pointer-events-none">
                                    <span className={`${!bean.roastDate ? 'text-neutral-500' : ''}`}>
                                        {bean.roastDate || '点击选择烘焙日期'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                );

            case 'detail':
                return (
                    <motion.div
                        key="detail-step"
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                        className="space-y-8 max-w-md mx-auto flex flex-col items-center justify-center h-full"
                    >
                        <div className="grid grid-cols-2 gap-6 w-full">
                            <AutocompleteInput
                                label="产地"
                                value={bean.origin || ''}
                                onChange={handleInputChange('origin')}
                                placeholder="例如：埃塞俄比亚"
                                suggestions={ORIGINS}
                                clearable
                            />

                            <AutocompleteInput
                                label="处理法"
                                value={bean.process || ''}
                                onChange={handleInputChange('process')}
                                placeholder="例如：水洗"
                                suggestions={PROCESSES}
                                clearable
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6 w-full">
                            <AutocompleteInput
                                label="品种"
                                value={bean.variety || ''}
                                onChange={handleInputChange('variety')}
                                placeholder="例如：卡杜拉"
                                suggestions={VARIETIES}
                                clearable
                            />

                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                    类型
                                </label>
                                <div className="flex w-full border-b border-neutral-300 dark:border-neutral-700">
                                    {BEAN_TYPES.map(type => (
                                        <div
                                            key={type.value}
                                            className="w-1/2 relative py-2"
                                            onClick={() => setBean({ ...bean, type: type.value })}
                                        >
                                            <button
                                                type="button"
                                                className={`w-full text-center transition-colors duration-200 ${bean.type === type.value
                                                    ? 'text-neutral-800 dark:text-neutral-200'
                                                    : 'text-neutral-500 dark:text-neutral-400'
                                                    }`}
                                            >
                                                {type.label}
                                            </button>
                                            {bean.type === type.value && (
                                                <div
                                                    className="absolute bottom-[-1px] left-0 w-full h-[1px] bg-neutral-800 dark:bg-neutral-200"
                                                ></div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 w-full">
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                备注
                            </label>
                            <AutoResizeTextarea
                                value={bean.notes || ''}
                                onChange={(e) => setBean({ ...bean, notes: e.target.value })}
                                placeholder="其他备注信息..."
                                className="w-full py-2 bg-transparent outline-none border-b border-neutral-300 dark:border-neutral-700 focus:border-neutral-800 dark:focus:border-neutral-400"
                            />
                        </div>
                    </motion.div>
                );

            case 'flavor':
                return (
                    <motion.div
                        key="flavor-step"
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                        className="space-y-8 max-w-md mx-auto flex flex-col items-center justify-center h-full"
                    >


                        {/* 已选风味标签 */}
                        <div className="space-y-2 w-full">
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                已选风味标签
                            </label>
                            <div className="flex flex-wrap gap-2 pb-2">
                                {bean.flavor && bean.flavor.length > 0 ? (
                                    bean.flavor.map((flavor, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center bg-neutral-200 dark:bg-neutral-800 rounded-full px-3 py-1"
                                        >
                                            <span className="text-xs">{flavor}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFlavor(flavor)}
                                                className="ml-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-neutral-500 dark:text-neutral-400 text-sm py-1 border-b border-neutral-300 dark:border-neutral-700 w-full">
                                        尚未添加风味标签
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 w-full">
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                添加风味标签
                            </label>
                            <div className="flex items-center w-full">
                                <div className="flex-1 border-b border-neutral-300 dark:border-neutral-700">
                                    <AutocompleteInput
                                        value={flavorInput}
                                        onChange={setFlavorInput}
                                        placeholder="例如：柑橘"
                                        suggestions={FLAVOR_TAGS.filter(tag => !bean.flavor?.includes(tag))}
                                        className="w-full border-none"
                                        onBlur={() => flavorInput.trim() && handleAddFlavor()}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddFlavor}
                                    className="ml-3 h-[36px] px-4 flex items-center justify-center text-xs font-medium bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 rounded-full"
                                >
                                    添加
                                </button>
                            </div>
                        </div>

                        {/* 分类的风味标签 */}
                        <div className="space-y-4 w-full">
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                常用风味标签
                            </label>

                            {Object.entries(FLAVOR_CATEGORIES).map(([category, tags]) => (
                                <div key={category} className="space-y-2">
                                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                        {category}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {tags.map((flavor) => (
                                            <button
                                                key={flavor}
                                                type="button"
                                                onClick={() => {
                                                    if (bean.flavor?.includes(flavor)) {
                                                        // 如果已经包含，点击时移除
                                                        handleRemoveFlavor(flavor);
                                                    } else {
                                                        // 如果不包含，点击时添加
                                                        setBean({
                                                            ...bean,
                                                            flavor: [...(bean.flavor || []), flavor]
                                                        });
                                                    }
                                                }}
                                                className={`rounded-full px-3 py-1 text-xs ${bean.flavor?.includes(flavor)
                                                    ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800'
                                                    : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                                                    }`}
                                            >
                                                {bean.flavor?.includes(flavor) ? `${flavor} ×` : flavor}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                );

            case 'complete':
                return (
                    <motion.div
                        key="complete-step"
                        initial="initial"
                        animate="in"
                        exit="out"
                        variants={pageVariants}
                        transition={pageTransition}
                        className="flex flex-col items-center justify-center pt-10 space-y-8 text-center relative"
                    >
                        <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                            <Check className="w-8 h-8 text-neutral-800 dark:text-neutral-200" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-medium text-neutral-800 dark:text-neutral-200">
                                {initialBean ? '咖啡豆编辑完成' : '咖啡豆添加完成'}
                            </h3>
                            <p className="text-neutral-600 dark:text-neutral-400">
                                你的咖啡豆信息已经准备就绪
                            </p>
                        </div>
                        <div className="w-full max-w-sm space-y-4 px-4">
                            <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm text-neutral-500 dark:text-neutral-400">咖啡豆名称</span>
                                <span className="text-sm font-medium">{bean.name}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm text-neutral-500 dark:text-neutral-400">总容量</span>
                                <span className="text-sm font-medium">{bean.capacity}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                <span className="text-sm text-neutral-500 dark:text-neutral-400">烘焙度</span>
                                <span className="text-sm font-medium">{bean.roastLevel}</span>
                            </div>
                            {bean.origin && (
                                <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">产地</span>
                                    <span className="text-sm font-medium">{bean.origin}</span>
                                </div>
                            )}
                            {bean.flavor && bean.flavor.length > 0 && (
                                <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
                                    <span className="text-sm text-neutral-500 dark:text-neutral-400">风味</span>
                                    <span className="text-sm font-medium">{bean.flavor.join(', ')}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                );

            default:
                return null;
        }
    };

    // 验证当前步骤是否可以进行下一步
    const isStepValid = () => {
        // 简化的验证逻辑，在basic步骤时，只要name不是空字符串就通过
        if (currentStep === 'basic') {
            // 直接检查name字段
            return typeof bean.name === 'string' && bean.name.trim() !== '';
        }
        return true;
    };

    // 渲染下一步按钮
    const renderNextButton = () => {
        const isLastStep = getCurrentStepIndex() === steps.length - 1;
        const valid = isStepValid();

        return (
            <div className="flex items-center justify-center my-4 sticky bottom-4">
                <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={!valid}
                    className={`
                        flex items-center justify-center rounded-full
                        ${!valid ? 'opacity-50 cursor-not-allowed' : ''}
                        ${isLastStep
                            ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-800 px-6 py-3'
                            : 'p-4 bg-neutral-50/80 dark:bg-neutral-900/80 backdrop-blur-md'
                        }
                    `}
                >
                    {isLastStep ? (
                        <span className="font-medium">完成</span>
                    ) : (
                        <div className="flex items-center relative">
                            <div className="w-24 h-0.5 bg-neutral-800 dark:bg-neutral-200"></div>
                            <div className="absolute -right-1 transform translate-x-0">
                                <ArrowRight className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
                            </div>
                        </div>
                    )}
                </button>
            </div>
        );
    };

    // 钩子函数确保任何步骤切换时都验证剩余容量
    useEffect(() => {
        // 当步骤变化时验证剩余容量
        validateRemaining();
    }, [currentStep, validateRemaining]);

    return (
        <div className="flex flex-col">
            {/* 顶部导航栏 */}
            <div className="flex items-center justify-between mt-3 mb-6">
                <button
                    type="button"
                    onClick={handleBack}
                    className="rounded-full"
                >
                    <ArrowLeft className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
                </button>
                <div className="w-full px-4">
                    {renderProgressBar()}
                </div>
                <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {getCurrentStepIndex() + 1}/{steps.length}
                </div>
            </div>

            {/* 步骤内容 */}
            <div className="flex-1 overflow-y-auto pb-4">
                <AnimatePresence mode="wait">
                    {renderStepContent()}
                </AnimatePresence>
            </div>

            {/* 下一步按钮 */}
            {renderNextButton()}
        </div>
    );
};

export default CoffeeBeanForm; 