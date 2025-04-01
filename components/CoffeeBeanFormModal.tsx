'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CoffeeBeanForm from '@/components/CoffeeBeanForm'
import { CoffeeBean } from '@/app/types'
import { Capacitor } from '@capacitor/core'

// 导入ExtendedCoffeeBean类型
interface BlendComponent {
    percentage: number;  // 百分比 (1-100)
    origin?: string;     // 产地
    process?: string;    // 处理法
    variety?: string;    // 品种
}

interface ExtendedCoffeeBean extends CoffeeBean {
    blendComponents?: BlendComponent[];
}

interface CoffeeBeanFormModalProps {
    showForm: boolean
    initialBean?: ExtendedCoffeeBean | null
    onSave: (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => void
    onClose: () => void
}

const CoffeeBeanFormModal: React.FC<CoffeeBeanFormModalProps> = ({
    showForm,
    initialBean,
    onSave,
    onClose
}) => {
    // 跟踪键盘状态
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
    
    // 监听键盘事件
    useEffect(() => {
        // 仅在原生平台上处理
        if (!Capacitor.isNativePlatform() || !showForm) return;
        
        // 处理键盘显示
        const handleKeyboardShow = () => {
            setIsKeyboardOpen(true);
        };
        
        // 处理键盘隐藏
        const handleKeyboardHide = () => {
            setIsKeyboardOpen(false);
        };
        
        // 添加事件监听器
        window.addEventListener('keyboardWillShow', handleKeyboardShow);
        window.addEventListener('keyboardDidShow', handleKeyboardShow);
        window.addEventListener('keyboardWillHide', handleKeyboardHide);
        window.addEventListener('keyboardDidHide', handleKeyboardHide);
        
        // 清理函数
        return () => {
            window.removeEventListener('keyboardWillShow', handleKeyboardShow);
            window.removeEventListener('keyboardDidShow', handleKeyboardShow);
            window.removeEventListener('keyboardWillHide', handleKeyboardHide);
            window.removeEventListener('keyboardDidHide', handleKeyboardHide);
        };
    }, [showForm]);
    
    return (
        <AnimatePresence>
            {showForm && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.265 }}
                    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            onClose()
                        }
                    }}
                >
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: "tween",
                            ease: [0.33, 1, 0.68, 1], // cubic-bezier(0.33, 1, 0.68, 1) - easeOutCubic
                            duration: 0.265
                        }}
                        style={{
                            willChange: "transform"
                        }}
                        className={`absolute inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl ${isKeyboardOpen ? 'keyboard-modal-active' : ''}`}
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
                            className="px-6 px-safe pb-6 pb-safe overflow-auto max-h-[calc(85vh-40px)] modal-form-container"
                        >
                            <CoffeeBeanForm
                                onSave={(bean) => {
                                    onSave(bean)
                                    onClose()
                                }}
                                onCancel={onClose}
                                initialBean={initialBean || undefined}
                            />
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default CoffeeBeanFormModal 