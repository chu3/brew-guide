'use client'

import React from 'react'
import { ExtendedCoffeeBean } from '../coffee-bean/List/types'
import { SettingsOptions } from './Settings'

interface BeanPreviewProps {
    settings: SettingsOptions
}

// 创建示例咖啡豆数据
const createSampleBeans = (): ExtendedCoffeeBean[] => [
    {
        id: 'preview-bean-1',
        timestamp: Date.now() - 1000,
        name: '蓝山一号 精选批次',
        beanType: 'filter',
        price: '298',
        capacity: '225g',
        remaining: '156g',
        roastLevel: '中浅烘焙',
        roastDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        flavor: ['柑橘', '蜂蜜', '花香', '坚果'],
        notes: '这是一款来自牙买加蓝山的精选咖啡豆，口感层次丰富，酸度明亮。',
        blendComponents: [{
            origin: '牙买加蓝山',
            process: '水洗',
            variety: '铁皮卡',
            percentage: 100
        }],
        startDay: 3,
        endDay: 21,
        isFrozen: false,
        isInTransit: false
    },
    {
        id: 'preview-bean-2',
        timestamp: Date.now(),
        name: '耶加雪菲 果丁丁',
        beanType: 'filter',
        price: '168',
        capacity: '200g',
        remaining: '95g',
        roastLevel: '浅烘焙',
        roastDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        flavor: ['柠檬', '茉莉花', '柑橘'],
        notes: '明亮的酸度，花香浓郁',
        blendComponents: [{
            origin: '埃塞俄比亚',
            process: '水洗',
            variety: '当地原生种',
            percentage: 100
        }],
        startDay: 3,
        endDay: 18,
        isFrozen: false,
        isInTransit: false
    },
    {
        id: 'preview-bean-3',
        timestamp: Date.now() + 1000,
        name: '哥伦比亚 慧兰',
        beanType: 'espresso',
        price: '185',
        capacity: '250g',
        remaining: '203g',
        roastLevel: '中深烘焙',
        roastDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        flavor: ['巧克力', '焦糖', '坚果'],
        notes: '醇厚回甘，适合意式浓缩',
        blendComponents: [{
            origin: '哥伦比亚',
            process: '水洗',
            variety: '卡杜拉',
            percentage: 100
        }],
        startDay: 3,
        endDay: 28,
        isFrozen: false,
        isInTransit: false
    }
]

const BeanPreview: React.FC<BeanPreviewProps> = ({ settings }) => {
    const sampleBeans = createSampleBeans()
    
    return (
        <>
            {/* 预览标识 - 位于预览区域上方 */}
            <div className="relative h-48 mb-8 overflow-hidden bg-neutral-50 dark:bg-neutral-900">
                {/* 咖啡豆列表容器 */}
                <div className="absolute inset-0 px-6 py-6">
                    <div className="flex flex-col justify-center h-full space-y-5">
                        {/* 第一个豆子 - 只露出下半部分 */}
                        <div className="transform">
                            <BeanPreviewItem
                                bean={sampleBeans[0]}
                                settings={settings}
                            />
                        </div>
                        
                        {/* 第二个豆子 - 完整显示在中间 */}
                        <div className="z-10">
                            <BeanPreviewItem
                                bean={sampleBeans[1]}
                                settings={settings}
                            />
                        </div>
                        
                        {/* 第三个豆子 - 只露出上半部分 */}
                        <div className="transform">
                            <BeanPreviewItem
                                bean={sampleBeans[2]}
                                settings={settings}
                            />
                        </div>
                    </div>
                </div>
                
                {/* 上边缘渐变阴影 */}
                <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-neutral-50 via-neutral-50/50 to-transparent dark:from-neutral-900/95 dark:via-neutral-900/50 pointer-events-none z-20" />
                
                {/* 下边缘渐变阴影 */}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 via-neutral-50/50 to-transparent dark:from-neutral-900/95 dark:via-neutral-900/50 pointer-events-none z-20" />
            </div>
        </>
    )
}

// 简化版的豆子预览组件，基于 BeanListItem 的样式
const BeanPreviewItem: React.FC<{
    bean: ExtendedCoffeeBean
    settings: SettingsOptions
}> = ({ bean, settings }) => {
    // 设置默认值
    const showOnlyBeanName = settings?.showOnlyBeanName ?? true
    const dateDisplayMode = settings?.dateDisplayMode ?? 'date'
    const showFlavorInfo = settings?.showFlavorInfo ?? false
    const limitNotesLines = settings?.limitNotesLines ?? true
    const notesMaxLines = settings?.notesMaxLines ?? 3
    const showTotalPrice = settings?.showTotalPrice ?? false
    const showStatusDots = settings?.showStatusDots ?? true

    // 生成显示标题
    const generateBeanTitle = (bean: ExtendedCoffeeBean, showOnlyName: boolean = false): string => {
        if (showOnlyName) {
            return bean.name
        }

        const additionalParams: string[] = []
        
        if (bean.roastLevel) {
            additionalParams.push(bean.roastLevel)
        }
        
        if (bean.blendComponents?.[0]?.origin) {
            additionalParams.push(bean.blendComponents[0].origin)
        }

        return additionalParams.length > 0
            ? `${bean.name} ${additionalParams.join(' ')}`
            : bean.name
    }

    const displayTitle = generateBeanTitle(bean, showOnlyBeanName)

    const formatNumber = (value: string | undefined): string =>
        !value ? '0' : (Number.isInteger(parseFloat(value)) ? Math.floor(parseFloat(value)).toString() : value)

    const formatDateShort = (dateStr: string): string => {
        try {
            const date = new Date(dateStr)
            const year = date.getFullYear().toString().slice(-2)
            return `${year}-${date.getMonth() + 1}-${date.getDate()}`
        } catch {
            return dateStr
        }
    }

    const getAgingDaysText = (dateStr: string): string => {
        try {
            const roastDate = new Date(dateStr)
            const today = new Date()
            const daysSinceRoast = Math.ceil((today.getTime() - roastDate.getTime()) / (1000 * 60 * 60 * 24))
            return `养豆${daysSinceRoast}天`
        } catch {
            return '养豆0天'
        }
    }

    const formatPrice = (price: string, capacity: string): string => {
        const priceNum = parseFloat(price)
        const capacityNum = parseFloat(capacity.replace('g', ''))
        if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum === 0) return ''

        const pricePerGram = (priceNum / capacityNum).toFixed(2)

        if (showTotalPrice) {
            return `${priceNum}元(${pricePerGram}元/克)`
        } else {
            return `${pricePerGram}元/克`
        }
    }

    const getFlavorPeriodStatus = (): string => {
        // 简化的赏味期计算，用于预览
        if (!bean.roastDate) return '未知状态'
        
        const daysSinceRoast = Math.ceil((new Date().getTime() - new Date(bean.roastDate).getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysSinceRoast < (bean.startDay || 3)) {
            const remainingDays = (bean.startDay || 3) - daysSinceRoast
            return `养豆 ${remainingDays}天`
        } else if (daysSinceRoast <= (bean.endDay || 21)) {
            const remainingDays = (bean.endDay || 21) - daysSinceRoast
            return `赏味 ${remainingDays}天`
        } else {
            return '已衰退'
        }
    }

    const getStatusDotColor = (): string => {
        if (!bean.roastDate) return 'bg-neutral-400'
        
        const daysSinceRoast = Math.ceil((new Date().getTime() - new Date(bean.roastDate).getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysSinceRoast < (bean.startDay || 3)) {
            return 'bg-amber-400'  // 养豆期
        } else if (daysSinceRoast <= (bean.endDay || 21)) {
            return 'bg-green-400'  // 赏味期
        } else {
            return 'bg-red-400'    // 衰退期
        }
    }

    const shouldShowNotes = () => (showFlavorInfo && bean.flavor?.length) || bean.notes

    const getFullNotesContent = () => {
        if (showFlavorInfo && bean.flavor?.length) {
            const flavorText = bean.flavor.join(' · ')
            return bean.notes ? `${flavorText}\n\n${bean.notes}` : flavorText
        }
        return bean.notes || ''
    }

    const getLineClampClass = (lines: number): string => {
        const clampClasses = ['', 'line-clamp-1', 'line-clamp-2', 'line-clamp-3', 'line-clamp-4', 'line-clamp-5', 'line-clamp-6']
        return clampClasses[lines] || 'line-clamp-3'
    }

    return (
        <div className="flex gap-3">
            <div className="relative self-start">
                <div className="w-14 h-14 relative shrink-0 rounded border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-100 dark:bg-neutral-800/20 overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-neutral-400 dark:text-neutral-600">
                        {bean.name ? bean.name.charAt(0) : '豆'}
                    </div>
                </div>

                {showStatusDots && bean.roastDate && (
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${getStatusDotColor()} border-2 border-white dark:border-neutral-900`} />
                )}
            </div>

            <div className="flex flex-col gap-y-2">
                <div className={`flex flex-col justify-center gap-y-1.5`}>
                    <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100 pr-2 leading-tight line-clamp-2">
                        {displayTitle}
                    </div>

                    <div className="text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {bean.roastDate && (
                            <span className="inline">
                                {dateDisplayMode === 'flavorPeriod'
                                    ? getFlavorPeriodStatus()
                                    : dateDisplayMode === 'agingDays'
                                    ? getAgingDaysText(bean.roastDate)
                                    : formatDateShort(bean.roastDate)
                                }
                                {((bean.capacity && bean.remaining) || (bean.price && bean.capacity)) && (
                                    <span className="mx-2 text-neutral-400 dark:text-neutral-600">·</span>
                                )}
                            </span>
                        )}

                        {bean.capacity && bean.remaining && (
                            <span className="inline">
                                <span className="border-dashed border-b border-neutral-400 dark:border-neutral-600">
                                    {formatNumber(bean.remaining)}
                                </span>
                                /{formatNumber(bean.capacity)}克
                                {bean.price && bean.capacity && <span className="mx-2 text-neutral-400 dark:text-neutral-600">·</span>}
                            </span>
                        )}

                        {bean.price && bean.capacity && (
                            <span className="inline">{formatPrice(bean.price, bean.capacity)}</span>
                        )}
                    </div>
                </div>

                {shouldShowNotes() && (
                    <div className="text-xs font-medium bg-neutral-200/30 dark:bg-neutral-800/40 p-1.5 rounded tracking-widest text-neutral-800/70 dark:text-neutral-400/85 whitespace-pre-line leading-tight">
                        <div className={limitNotesLines ? getLineClampClass(notesMaxLines) : ''}>
                            {getFullNotesContent()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default BeanPreview