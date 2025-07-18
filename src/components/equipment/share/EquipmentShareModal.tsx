'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomEquipment, Method } from '@/lib/core/config';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { showToast } from '../../common/feedback/GlobalToast';

interface EquipmentShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    equipment: CustomEquipment;
    methods: Method[];
}

const EquipmentShareModal: React.FC<EquipmentShareModalProps> = ({
    isOpen,
    onClose,
    equipment,
    methods
}) => {
    const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
    const [isSharing, setIsSharing] = useState(false);
    const isNative = Capacitor.isNativePlatform();

    // Reset selected methods when modal opens - 默认选择所有方案
    useEffect(() => {
        if (isOpen) {
            setSelectedMethods(methods.map(method => method.id || method.name));
        }
    }, [isOpen, methods]);



    // Handle share button click
    const handleShare = async () => {
        try {
            setIsSharing(true);

            // Prepare export data
            const exportData = {
                equipment: {
                    ...equipment,
                    // 确保包含自定义注水动画配置
                    customPourAnimations: equipment.customPourAnimations || [],
                    // 保留ID信息，确保方案能正确关联
                    id: equipment.id
                },
                methods: methods.length > 0 ? methods.filter(method =>
                    selectedMethods.includes(method.id || method.name)
                ).map(method => ({
                    ...method,
                    // 保留ID，确保关联性
                    id: method.id
                })) : []
            };



            // Convert to JSON
            const jsonData = JSON.stringify(exportData, null, 2);

            // Generate filename based on equipment name
            const fileName = `brew-guide-equipment-${equipment.name.replace(/\s+/g, '-')}.json`;

            if (isNative) {
                try {
                    // Write file to temporary directory
                    await Filesystem.writeFile({
                        path: fileName,
                        data: jsonData,
                        directory: Directory.Cache,
                        encoding: Encoding.UTF8
                    });

                    // Get URI for the temporary file
                    const uriResult = await Filesystem.getUri({
                        path: fileName,
                        directory: Directory.Cache
                    });

                    // Use share functionality to let user choose save location
                    await Share.share({
                        title: '分享器具',
                        text: '请选择保存位置',
                        url: uriResult.uri,
                        dialogTitle: '分享器具'
                    });

                    // Clean up temporary file
                    await Filesystem.deleteFile({
                        path: fileName,
                        directory: Directory.Cache
                    });

                    showToast({
                        type: 'success',
                        title: '器具已成功导出',
                        duration: 2000
                    });

                    onClose();
                } catch (_error) {
                    showToast({
                        type: 'error',
                        title: '导出失败，请重试',
                        duration: 2000
                    });
                }
            } else {
                // Web platform handling
                const blob = new Blob([jsonData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();

                // Clean up
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);

                showToast({
                    type: 'success',
                    title: '器具已成功导出',
                    duration: 2000
                });

                onClose();
            }
        } catch (_error) {
            showToast({
                type: 'error',
                title: '导出失败，请重试',
                duration: 2000
            });
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.265 }}
                    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs"
                >
                    <motion.div
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
                        className={`absolute inset-x-0 bottom-0 max-w-[500px] mx-auto max-h-[85vh] overflow-auto rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl`}
                    >
                        {/* 拖动条 */}
                        <div className="sticky top-0 z-10 flex justify-center py-2 bg-neutral-50 dark:bg-neutral-900">
                            <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                        </div>

                        {/* 内容 */}
                        <div className="px-6 pb-safe-bottom">
                            {/* 标题栏 */}
                            <div className="flex items-center justify-between py-4 mb-2">
                                <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                                    分享 {equipment.name}
                                </h3>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>

                            {/* 导出内容说明 */}
                            <div className="mb-6">
                                <div className="p-4 bg-neutral-100/60 dark:bg-neutral-800/30 rounded-lg">
                                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">
                                        将导出以下内容：
                                    </div>
                                    <div className="space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                                        <div>• 器具配置：{equipment.name}</div>
                                        {methods.length > 0 ? (
                                            <div>• 自定义方案：{methods.length} 个</div>
                                        ) : (
                                            <div>• 自定义方案：无</div>
                                        )}
                                        <div className="mt-2 text-neutral-500 dark:text-neutral-500">
                                            通用方案会根据器具类型自动加载，无需包含
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 按钮 */}
                            <button
                                onClick={handleShare}
                                disabled={isSharing}
                                className={`w-full mt-6 py-2.5 px-4 rounded-lg transition-colors ${isSharing
                                    ? 'bg-neutral-400 dark:bg-neutral-700 cursor-not-allowed'
                                    : 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 hover:opacity-80'
                                    }`}
                            >
                                {isSharing ? '导出中...' : '导出为文件'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default EquipmentShareModal;
