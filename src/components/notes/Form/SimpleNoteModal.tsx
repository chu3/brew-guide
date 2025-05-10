'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Capacitor } from '@capacitor/core'
import BrewingNoteForm from './BrewingNoteForm'
import type { BrewingNoteData, CoffeeBean } from '@/types/app'

interface SimpleNoteModalProps {
    showForm: boolean
    onClose: () => void
    onSave: (data: BrewingNoteData) => void
    initialNote: Partial<BrewingNoteData> & {
        coffeeBean?: CoffeeBean | null;
        id?: string;
    }
}

const SimpleNoteModal: React.FC<SimpleNoteModalProps> = ({
    showForm,
    onClose,
    onSave,
    initialNote
}) => {
    // 检测 iOS 平台
    const [isIOS, setIsIOS] = useState(false)
    
    // 模态框引用
    const modalRef = useRef<HTMLDivElement>(null)
    
    // 检测平台
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            const platform = Capacitor.getPlatform()
            setIsIOS(platform === 'ios')
        }
    }, [])
    
    // 当模态框显示时设置标记
    useEffect(() => {
        if (showForm) {
            // 设置标记，表示正在显示记录表单，防止参数栏被更新
            localStorage.setItem("brewingNoteInProgress", "true");
        }
    }, [showForm, initialNote]);
    
    // 处理关闭
    const handleClose = () => {
        // 清除记录表单状态标记，允许参数栏更新
        localStorage.setItem("brewingNoteInProgress", "false");
        
        // 设置标记，表示刚从记录表单返回，帮助后续流程中的状态管理
        localStorage.setItem("wasInNoteForm", "true");
        
        // 触发记录表单关闭事件，通知其他组件更新状态
        window.dispatchEvent(new CustomEvent('brewing:noteFormClosed'));
        
        onClose();
    }
    
    // 处理输入框聚焦，确保在 iOS 上输入框可见
    useEffect(() => {
        if (!showForm) return
        
        const modalElement = modalRef.current
        if (!modalElement) return
        
        const handleInputFocus = (e: Event) => {
            const target = e.target as HTMLElement
            
            // 确定是否为输入元素
            if (
                target && 
                (target.tagName === 'INPUT' || 
                 target.tagName === 'TEXTAREA' || 
                 target.tagName === 'SELECT')
            ) {
                // 对于 iOS，需要特殊处理
                if (isIOS) {
                    // 延迟一点以确保键盘完全弹出
                    setTimeout(() => {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        })
                    }, 300)
                }
            }
        }
        
        // 只在模态框内监听聚焦事件
        modalElement.addEventListener('focusin', handleInputFocus)
        
        return () => {
            modalElement.removeEventListener('focusin', handleInputFocus)
        }
    }, [showForm, isIOS])
    
    return (
        <AnimatePresence>
            {showForm && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.265 }}
                    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                    onClick={handleClose}
                >
                    <motion.div
                        ref={modalRef}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: "tween",
                            ease: [0.33, 1, 0.68, 1], // easeOutCubic
                            duration: 0.265
                        }}
                        style={{
                            willChange: "transform"
                        }}
                        className="absolute inset-x-0 bottom-0 max-w-[500px] mx-auto max-h-[85vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 拖动条 */}
                        <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
                            <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                        </div>

                        {/* 表单内容 */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                type: "tween",
                                ease: "easeOut",
                                duration: 0.265,
                                delay: 0.05
                            }}
                            style={{
                                willChange: "opacity, transform"
                            }}
                            className="overflow-auto max-h-[calc(85vh-40px)] px-6"
                        >
                            <BrewingNoteForm
                                id={initialNote?.id}
                                isOpen={true}
                                onClose={handleClose}
                                onSave={(data) => {
                                    // 先保存数据
                                    onSave(data);
                                    
                                    // 触发笔记已保存事件
                                    window.dispatchEvent(new CustomEvent('brewing:noteSaved', {
                                        detail: { id: data.id }
                                    }));
                                    
                                    // 确保所有状态被清理
                                    localStorage.setItem("brewingNoteInProgress", "false");
                                    localStorage.setItem("wasInNoteForm", "true");
                                    
                                    // 然后关闭模态框
                                    handleClose();
                                }}
                                initialData={initialNote}
                                inBrewPage={true}
                            />
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default SimpleNoteModal 