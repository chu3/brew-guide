'use client'

import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
// import ActionMenu, { ActionMenuItem } from '@/components/coffee-bean/ui/action-menu' // 移除操作菜单
import { ExtendedCoffeeBean, generateBeanTitle } from '../types'
import { isBeanEmpty } from '../globalCache'
import { parseDateToTimestamp } from '@/lib/utils/dateUtils'
import HighlightText from '@/components/common/ui/HighlightText'

// 动态导入 ImageViewer 组件 - 移除加载占位符
const ImageViewer = dynamic(() => import('@/components/common/ui/ImageViewer'), {
    ssr: false
})

interface BeanListItemProps {
    bean: ExtendedCoffeeBean
    title?: string
    isLast: boolean
    onRemainingClick: (bean: ExtendedCoffeeBean, event: React.MouseEvent) => void
    onDetailClick?: (bean: ExtendedCoffeeBean) => void
    searchQuery?: string
    settings?: {
        showFlavorPeriod?: boolean
        showOnlyBeanName?: boolean
        showFlavorInfo?: boolean
        limitNotesLines?: boolean
        notesMaxLines?: number
    }
}

const BeanListItem: React.FC<BeanListItemProps> = ({
    bean,
    title,
    onRemainingClick,
    onDetailClick,
    searchQuery = '',
    settings
}) => {
    // 状态管理
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isNotesExpanded, setIsNotesExpanded] = useState(false);

    // 设置默认值
    const showOnlyBeanName = settings?.showOnlyBeanName ?? true;
    const showFlavorPeriod = settings?.showFlavorPeriod ?? false;
    const showFlavorInfo = settings?.showFlavorInfo ?? false;
    const limitNotesLines = settings?.limitNotesLines ?? true;
    const notesMaxLines = settings?.notesMaxLines ?? 3;



    // 计算赏味期信息
    const flavorInfo = useMemo(() => {
        if (bean.isInTransit) {
            return { phase: '在途', status: '在途', remainingDays: 0, progressPercent: 0, preFlavorPercent: 0, flavorPercent: 100, daysSinceRoast: 0, endDay: 0, isFrozen: false, isInTransit: true };
        }

        if (!bean.roastDate) {
            return { phase: '未知', status: '未知', remainingDays: 0, progressPercent: 0, preFlavorPercent: 0, flavorPercent: 0, daysSinceRoast: 0, endDay: 0, isFrozen: false, isInTransit: false };
        }

        if (bean.isFrozen) {
            return { phase: '冰冻', status: '冰冻', remainingDays: 0, progressPercent: 0, preFlavorPercent: 0, flavorPercent: 100, daysSinceRoast: 0, endDay: 0, isFrozen: true, isInTransit: false };
        }

        const today = new Date();
        const roastTimestamp = parseDateToTimestamp(bean.roastDate);
        const roastDate = new Date(roastTimestamp);
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const roastDateOnly = new Date(roastDate.getFullYear(), roastDate.getMonth(), roastDate.getDate());
        const daysSinceRoast = Math.ceil((todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24));

        let startDay = bean.startDay || 0;
        let endDay = bean.endDay || 0;

        if (startDay === 0 && endDay === 0) {
            if (bean.roastLevel?.includes('浅')) {
                startDay = 7; endDay = 30;
            } else if (bean.roastLevel?.includes('深')) {
                startDay = 14; endDay = 60;
            } else {
                startDay = 10; endDay = 30;
            }
        }

        const progressPercent = Math.min((daysSinceRoast / endDay) * 100, 100);
        const preFlavorPercent = (startDay / endDay) * 100;
        const flavorPercent = ((endDay - startDay) / endDay) * 100;

        let phase, status, remainingDays;
        if (daysSinceRoast < startDay) {
            phase = '养豆期';
            remainingDays = startDay - daysSinceRoast;
            status = `养豆 ${remainingDays}天`;
        } else if (daysSinceRoast <= endDay) {
            phase = '赏味期';
            remainingDays = endDay - daysSinceRoast;
            status = `赏味 ${remainingDays}天`;
        } else {
            phase = '衰退期';
            remainingDays = 0;
            status = '已衰退';
        }

        return { phase, remainingDays, progressPercent, preFlavorPercent, flavorPercent, status, daysSinceRoast, endDay, isFrozen: false, isInTransit: false };
    }, [bean.roastDate, bean.startDay, bean.endDay, bean.roastLevel, bean.isFrozen, bean.isInTransit]);

    const isEmpty = isBeanEmpty(bean);
    const displayTitle = title || generateBeanTitle(bean, showOnlyBeanName);

    const formatNumber = (value: string | undefined): string =>
        !value ? '0' : (Number.isInteger(parseFloat(value)) ? Math.floor(parseFloat(value)).toString() : value);

    const formatDateShort = (dateStr: string): string => {
        try {
            const timestamp = parseDateToTimestamp(dateStr);
            const date = new Date(timestamp);
            const year = date.getFullYear().toString().slice(-2);
            return `${year}-${date.getMonth() + 1}-${date.getDate()}`;
        } catch {
            return dateStr;
        }
    };

    const formatPricePerGram = (price: string, capacity: string): string => {
        const priceNum = parseFloat(price);
        const capacityNum = parseFloat(capacity.replace('g', ''));
        if (isNaN(priceNum) || isNaN(capacityNum) || capacityNum === 0) return '';
        return `${(priceNum / capacityNum).toFixed(2)}元/克`;
    };

    const getStatusDotColor = (phase: string): string => {
        const colors = {
            '养豆期': 'bg-amber-400',
            '赏味期': 'bg-green-400',
            '衰退期': 'bg-red-400',
            '在途': 'bg-blue-400',
            '冰冻': 'bg-cyan-400'
        };
        return colors[phase as keyof typeof colors] || 'bg-neutral-400';
    };

    const handleCardClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-click-area="image"]') ||
            target.closest('[data-click-area="remaining-edit"]') ||
            target.closest('[data-click-area="notes"]')) {
            return;
        }
        onDetailClick?.(bean);
    };

    const getFullNotesContent = () => {
        if (showFlavorInfo && bean.flavor?.length) {
            const flavorText = bean.flavor.join(' · ');
            return bean.notes ? `${flavorText}\n\n${bean.notes}` : flavorText;
        }
        return bean.notes || '';
    };

    const shouldShowNotes = () => (showFlavorInfo && bean.flavor?.length) || bean.notes;

    const handleNotesClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (limitNotesLines) setIsNotesExpanded(!isNotesExpanded);
    };

    const getLineClampClass = (lines: number): string => {
        const clampClasses = ['', 'line-clamp-1', 'line-clamp-2', 'line-clamp-3', 'line-clamp-4', 'line-clamp-5', 'line-clamp-6'];
        return clampClasses[lines] || 'line-clamp-3';
    };

    return (
        <div
            className={`group ${isEmpty ? 'bg-neutral-100/60 dark:bg-neutral-800/30' : ''} ${onDetailClick ? 'cursor-pointer transition-colors' : ''}`}
            onClick={handleCardClick}
        >
            <div className="flex gap-3">
                <div className="relative self-start">
                    <div
                        className="w-14 h-14 relative shrink-0 cursor-pointer rounded border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-100 dark:bg-neutral-800/20 overflow-hidden"
                        onClick={() => bean.image && !imageError && setImageViewerOpen(true)}
                        data-click-area="image"
                    >
                        {bean.image && !imageError ? (
                            <Image
                                src={bean.image}
                                alt={bean.name || '咖啡豆图片'}
                                height={48}
                                width={48}
                                unoptimized
                                style={{ width: '100%', height: '100%' }}
                                className="object-cover"
                                sizes="48px"
                                priority={true}
                                loading="eager"
                                onError={() => setImageError(true)}
                                placeholder="blur"
                                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-neutral-400 dark:text-neutral-600">
                                {bean.name ? bean.name.charAt(0) : '豆'}
                            </div>
                        )}
                    </div>

                    {bean.roastDate && (bean.startDay || bean.endDay || bean.roastLevel) && (
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${getStatusDotColor(flavorInfo.phase)} border-2 border-neutral-50 dark:border-neutral-900`} />
                    )}
                </div>

                {bean.image && !imageError && imageViewerOpen && (
                    <ImageViewer
                        isOpen={imageViewerOpen}
                        imageUrl={bean.image}
                        alt={bean.name || '咖啡豆图片'}
                        onClose={() => setImageViewerOpen(false)}
                    />
                )}

                <div className="flex-1 min-w-0 flex flex-col gap-y-2">
                    <div className={`flex flex-col justify-center gap-y-1.5 ${shouldShowNotes() ? '' : 'h-14'}`}>
                        <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100 pr-2 leading-tight line-clamp-2">
                            {searchQuery ? (
                                <HighlightText text={displayTitle} highlight={searchQuery} />
                            ) : displayTitle}
                            {isEmpty && <span className="text-neutral-500 dark:text-neutral-400 font-normal">（已用完）</span>}
                        </div>

                        <div className="flex items-center text-xs font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                            {bean.roastDate && !bean.isInTransit && (
                                <>
                                    <span className="shrink-0">
                                        {showFlavorPeriod ? flavorInfo.status : formatDateShort(bean.roastDate)}
                                    </span>
                                    {((bean.capacity && bean.remaining) || (bean.price && bean.capacity)) && (
                                        <span className="mx-2 text-neutral-400 dark:text-neutral-600">·</span>
                                    )}
                                </>
                            )}

                            {bean.capacity && bean.remaining && (
                                <>
                                    <span className="shrink-0">
                                        <span onClick={(e) => onRemainingClick(bean, e)} className="cursor-pointer" data-click-area="remaining-edit">
                                            <span className="border-dashed border-b border-neutral-400 dark:border-neutral-600 transition-colors">
                                                {formatNumber(bean.remaining)}
                                            </span>
                                            /{formatNumber(bean.capacity)}克
                                        </span>
                                    </span>
                                    {bean.price && bean.capacity && <span className="mx-2 text-neutral-400 dark:text-neutral-600">·</span>}
                                </>
                            )}

                            {bean.price && bean.capacity && (
                                <span className="shrink-0">{formatPricePerGram(bean.price, bean.capacity)}</span>
                            )}
                        </div>
                    </div>

                    {shouldShowNotes() && (
                        <div
                            className={`text-xs font-medium bg-neutral-200/30 dark:bg-neutral-800/40 p-1.5 rounded tracking-widest text-neutral-800/70 dark:text-neutral-400/85 whitespace-pre-line leading-tight ${
                                limitNotesLines ? 'cursor-pointer hover:bg-neutral-200/40 dark:hover:bg-neutral-800/50 transition-colors' : ''
                            }`}
                            onClick={handleNotesClick}
                            data-click-area="notes"
                        >
                            <div className={!isNotesExpanded && limitNotesLines ? getLineClampClass(notesMaxLines) : ''}>
                                {searchQuery ? (
                                    <HighlightText
                                        text={getFullNotesContent()}
                                        highlight={searchQuery}
                                        className="text-neutral-600 dark:text-neutral-400"
                                    />
                                ) : getFullNotesContent()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// 使用 React.memo 包装组件以避免不必要的重新渲染
export default React.memo(BeanListItem) 