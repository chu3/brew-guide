'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactCrop, { Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { recognizeImage, RecognitionError } from '@/services/recognition'
import { debounce } from 'lodash'

interface ImportBeanModalProps {
    showForm: boolean
    onImport: (jsonData: string) => Promise<void>
    onClose: () => void
}

interface ImportedBean {
    capacity?: number | string;
    remaining?: number | string;
    price?: number | string | null;
    [key: string]: unknown;
}

const ImportBeanModal: React.FC<ImportBeanModalProps> = ({
    showForm,
    onImport,
    onClose
}) => {
    // 导入数据的状态
    const [importData, setImportData] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const _fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [crop, setCrop] = useState<Crop>({
        unit: '%',
        width: 90,
        height: 90,
        x: 5,
        y: 5
    });
    const [croppedImage, setCroppedImage] = useState<string | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // 添加手动模式状态
    const [manualMode, setManualMode] = useState(false);

    // Function to handle crop complete - 移到前面并使用useCallback并添加防抖处理
    const handleCropComplete = useCallback(
        debounce(async (crop: Crop) => {
            if (!selectedImage || !imgRef.current) return;

            const image = new Image();
            image.src = selectedImage;

            // 等待图片加载完成
            await new Promise((resolve) => {
                if (image.complete) {
                    resolve(true);
                } else {
                    image.onload = () => resolve(true);
                }
            });

            const canvas = document.createElement('canvas');
            // 获取显示的图片元素
            const displayedImage = imgRef.current;

            // 计算实际比例
            const scaleX = image.naturalWidth / displayedImage.width;
            const scaleY = image.naturalHeight / displayedImage.height;

            // 根据单位计算裁剪区域的实际尺寸
            let cropWidth, cropHeight, cropX, cropY;
            if (crop.unit === '%') {
                cropWidth = (crop.width! / 100) * displayedImage.width;
                cropHeight = (crop.height! / 100) * displayedImage.height;
                cropX = (crop.x! / 100) * displayedImage.width;
                cropY = (crop.y! / 100) * displayedImage.height;
            } else {
                cropWidth = crop.width!;
                cropHeight = crop.height!;
                cropX = crop.x!;
                cropY = crop.y!;
            }

            // 降低画布分辨率以提升性能，减小输出图片的尺寸
            const maxCanvasSize = 800; // 最大尺寸限制，防止生成过大的图片
            const aspectRatio = cropWidth / cropHeight;
            
            let finalWidth = cropWidth * scaleX;
            let finalHeight = cropHeight * scaleY;
            
            // 如果图片过大，则按比例缩小
            if (finalWidth > maxCanvasSize || finalHeight > maxCanvasSize) {
                if (aspectRatio >= 1) {
                    finalWidth = maxCanvasSize;
                    finalHeight = finalWidth / aspectRatio;
                } else {
                    finalHeight = maxCanvasSize;
                    finalWidth = finalHeight * aspectRatio;
                }
            }
            
            // 设置画布尺寸为调整后的大小
            canvas.width = finalWidth;
            canvas.height = finalHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // 使用更高效的绘图方式
            ctx.drawImage(
                image,
                cropX * scaleX,
                cropY * scaleY,
                cropWidth * scaleX,
                cropHeight * scaleY,
                0,
                0,
                finalWidth,
                finalHeight
            );

            // 使用较低的图片质量来提高性能
            const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setCroppedImage(croppedDataUrl);
        }, 150), // 150毫秒的防抖延迟
        [selectedImage]
    );

    // Automatically trigger crop complete when cropper is shown
    useEffect(() => {
        if (showCropper && selectedImage && crop.width && crop.height) {
            const imageElement = imgRef.current;
            if (imageElement && imageElement.complete) {
                handleCropComplete(crop);
            } else if (imageElement) {
                imageElement.onload = () => handleCropComplete(crop);
            }
        }
    }, [showCropper, selectedImage, crop, handleCropComplete]);

    // 清除所有状态消息
    const clearMessages = () => {
        setError(null);
        setSuccess(null);
    };

    // 监听showForm变化，当表单关闭时清除输入框内容
    useEffect(() => {
        if (!showForm) {
            setImportData('');
            clearMessages();
        }
    }, [showForm]);

    // 关闭并清除输入
    const handleClose = () => {
        setImportData('');
        clearMessages();
        onClose();
    };

    // 生成模板提示词
    const _templatePrompt = (() => {
        // 不再使用模板生成
        // const templateJson = generateBeanTemplateJson();
        return `提取咖啡豆数据，返回JSON格式。支持批量导入。

单个咖啡豆使用：{...}
多个咖啡豆使用：[{...},{...}]

数据字段：
- id: 留空
- name: 咖啡豆名称（必填）
- capacity: 总容量，纯数字
- remaining: 剩余容量，纯数字（若无标注则与capacity相同）
- price: 价格，纯数字
- roastLevel: 烘焙度（浅度烘焙/中浅烘焙/中度烘焙/中深烘焙/深度烘焙）
- roastDate: 烘焙日期，格式YYYY-MM-DD
- flavor: 风味描述标签数组
- origin: 产地
- process: 处理法
- variety: 品种（如瑰夏）
- type: 类型，必须为"单品"或"拼配"
- notes: 备注信息
- startDay: 养豆期天数，纯数字
- endDay: 赏味期天数，纯数字
- blendComponents: 拼配成分，格式[{"percentage":比例(纯数字),"origin":"产地","process":"处理法","variety":"品种"}]

要求：
1. 不确定的字段留空或为[]
2. 确保JSON格式有效，数值字段不包含单位`;
    })();

    // 兼容性更好的复制文本方法
    const _copyTextToClipboard = async (text: string) => {
        try {
            // 首先尝试使用现代API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                setSuccess('复制成功');
                setTimeout(() => setSuccess(null), 2000);
                return;
            }

            // 回退方法：创建临时textarea元素
            const textArea = document.createElement('textarea');
            textArea.value = text;

            // 设置样式使其不可见
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);

            // 选择文本并复制
            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            if (successful) {
                setSuccess('复制成功');
                setTimeout(() => setSuccess(null), 2000);
            } else {
                setError('复制失败');
                setTimeout(() => setError(null), 2000);
            }
        } catch (_err) {
            setError('复制失败');
            setTimeout(() => setError(null), 2000);
        } finally {
            if (document.querySelector('textarea[style*="-999999px"]')) {
                document.body.removeChild(document.querySelector('textarea[style*="-999999px"]')!);
            }
        }
    }

    // 处理导入数据，添加时间戳
    const handleImport = () => {
        if (!importData) {
            setError('请输入要导入的数据');
            return;
        }

        // 确保某些字段始终是字符串类型
        const ensureStringFields = (item: ImportedBean) => {
            const result = { ...item };
            // 确保 capacity 和 remaining 是字符串
            if (result.capacity !== undefined && result.capacity !== null) {
                result.capacity = String(result.capacity);
            }
            if (result.remaining !== undefined && result.remaining !== null) {
                result.remaining = String(result.remaining);
            }
            // 确保 price 是字符串
            if (result.price !== undefined && result.price !== null) {
                result.price = String(result.price);
            }
            return result;
        };

        try {
            // 尝试从文本中提取数据
            import('@/lib/jsonUtils').then(async ({ extractJsonFromText }) => {
                setError(null);
                const beanData = extractJsonFromText(importData);

                if (!beanData) {
                    setError('无法从输入中提取有效数据');
                    return;
                }

                // 处理单个或多个咖啡豆数据
                if (Array.isArray(beanData)) {
                    // 处理多个咖啡豆
                    // 验证每个条目都是咖啡豆
                    if (!beanData.every(item => 'roastLevel' in item)) {
                        setError('部分数据不是有效的咖啡豆信息');
                        return;
                    }
                    
                    // 处理数组中的每个咖啡豆对象
                    const processedBeans = beanData.map(bean => ({
                        ...ensureStringFields(bean as unknown as ImportedBean),
                        timestamp: Date.now()
                    }));
                    
                    try {
                        setSuccess('正在批量导入咖啡豆数据...');
                        await onImport(JSON.stringify(processedBeans));
                        handleClose();
                    } catch (error) {
                        setError('导入失败: ' + (error instanceof Error ? error.message : '未知错误'));
                        setSuccess(null);
                    }
                } else {
                    // 处理单个咖啡豆
                    if (!('roastLevel' in beanData)) {
                        setError('提取的数据不是有效的咖啡豆信息');
                        return;
                    }
                    
                    const dataWithTimestamp = {
                        ...ensureStringFields(beanData as unknown as ImportedBean),
                        timestamp: Date.now()
                    };
                    
                    try {
                        setSuccess('正在导入咖啡豆数据...');
                        await onImport(JSON.stringify([dataWithTimestamp])); // 始终返回数组格式
                        handleClose();
                    } catch (error) {
                        setError('导入失败: ' + (error instanceof Error ? error.message : '未知错误'));
                        setSuccess(null);
                    }
                }
            }).catch(err => {
                setError('数据处理失败: ' + (err instanceof Error ? err.message : '未知错误'));
                setSuccess(null);
            });
        } catch (err) {
            setError('处理数据时出错: ' + (err instanceof Error ? err.message : '未知错误'));
            setSuccess(null);
        }
    };

    // Function to handle image selection from camera or gallery
    const handleImageSelect = (source: 'camera' | 'gallery') => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        if (source === 'camera') {
            input.capture = 'environment';
        }

        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                    // 创建一个新的图片对象来获取实际尺寸
                    const img = new Image();
                    img.onload = () => {
                        setSelectedImage(img.src);
                        setShowCropper(true);
                        // 根据图片实际尺寸设置初始裁剪区域
                        setCrop({
                            unit: '%',
                            width: 90,
                            height: 90,
                            x: 5,
                            y: 5
                        });
                    };
                    img.src = reader.result as string;
                };
                reader.readAsDataURL(file);
            }
        };

        input.click();
    };

    // Function to handle image recognition process
    const handleImageRecognition = async () => {
        if (!croppedImage) return;

        setIsUploading(true);
        clearMessages();

        try {
            const response = await fetch(croppedImage);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('file', blob, 'coffee-bean.jpg');

            const data = await recognizeImage(formData);

            if (data.result) {
                setImportData(JSON.stringify(data.result, null, 2));
                setSuccess('✨ AI识别成功！请检查识别结果是否正确');
            }

        } catch (err) {
            console.error('识别失败:', err);
            if (err instanceof RecognitionError) {
                setError(err.message);
            } else {
                setError('图片识别失败，请重试');
            }
        } finally {
            setIsUploading(false);
            setShowCropper(false);
            setSelectedImage(null);
            setCroppedImage(null);
        }
    };

    // 手动模式切换
    const toggleManualMode = () => {
        setManualMode(!manualMode);
        clearMessages();
    };

    // 渲染上传部分
    const renderUploadSection = () => (
        <div className="p-3 border relative border-neutral-200 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-800/50">
            <button
                onClick={toggleManualMode}
                className="text-xs px-2 py-1 absolute right-0 top-0 rounded-bl bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            >
                {manualMode ? '切换识图' : '切换手动'}
            </button>
            <div className="flex flex-col space-y-3">
                <div className="flex justify-between items-center">
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        {manualMode ? '手动填写咖啡豆信息' : '上传咖啡豆包装图片，自动识别信息'}
                    </p>

                </div>

                {manualMode ? (
                    <div className="space-y-3 py-1">
                        <div className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded-md text-xs text-neutral-600 dark:text-neutral-400">
                            <p className="mb-2">使用《豆包》AI获取JSON数据：</p>
                            <ol className="list-decimal pl-6 space-y-1">
                                <li>准备好咖啡豆商品页截图（多豆批量导入需多次识别）</li>
                                <li>打开《豆包》将提示词与截图一并发送</li>
                                <li>将返回的 json 数据复制进来（多豆请使用[{},{}]格式）</li>
                            </ol>
                        </div>
                        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-3 rounded-md text-xs">
                            <div className="flex justify-between mb-1">
                                <span className="text-neutral-500 dark:text-neutral-400">提示词：</span>
                                <button
                                    onClick={() => {
                                        clearMessages();
                                        _copyTextToClipboard(_templatePrompt);
                                    }}
                                    className="text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded text-[10px] border border-neutral-300 dark:border-neutral-700"
                                >
                                    复制
                                </button>
                            </div>
                            <p className="text-neutral-800 dark:text-neutral-200 text-[10px] line-clamp-2">
                                提取咖啡豆数据，返回JSON格式。包含名称、产地、处理法、风味等信息...
                            </p>
                        </div>
                    </div>
                ) : showCropper && selectedImage ? (
                    <div className="space-y-3">
                        <ReactCrop
                            crop={crop}
                            onChange={c => setCrop(c)}
                            onComplete={handleCropComplete}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                ref={imgRef}
                                src={selectedImage}
                                alt="Upload preview"
                                style={{ maxHeight: '60vh' }} // 限制图片显示高度，避免过大图片导致性能问题
                            />
                        </ReactCrop>
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => {
                                    setShowCropper(false);
                                    setSelectedImage(null);
                                }}
                                className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleImageRecognition}
                                className="px-3 py-1 text-sm bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 rounded"
                            >
                                确认裁剪并识别
                            </button>
                        </div>
                    </div>
                ) : !manualMode && (
                    <div className="flex space-x-2">
                        <button
                            onClick={() => handleImageSelect('camera')}
                            disabled={isUploading}
                            className="flex-1 py-2 px-4 border border-dashed border-neutral-300 dark:border-neutral-600 rounded-md text-sm text-neutral-600 dark:text-neutral-400"
                        >
                            <span className="flex items-center justify-center space-x-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>拍照</span>
                            </span>
                        </button>
                        <button
                            onClick={() => handleImageSelect('gallery')}
                            disabled={isUploading}
                            className="flex-1 py-2 px-4 border border-dashed border-neutral-300 dark:border-neutral-600 rounded-md text-sm text-neutral-600 dark:text-neutral-400"
                        >
                            <span className="flex items-center justify-center space-x-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>相册</span>
                            </span>
                        </button>
                    </div>
                )}

                {isUploading && (
                    <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-sm">处理中...</span>
                    </div>
                )}
            </div>
        </div>
    );

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
                            handleClose()
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
                        className="absolute inset-x-0 bottom-0 max-w-[500px] mx-auto max-h-[90vh] overflow-hidden rounded-t-2xl bg-neutral-50 dark:bg-neutral-900 shadow-xl"
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
                            className="px-6 px-safe pb-6 pb-safe overflow-auto max-h-[calc(90vh-40px)]"
                        >
                            <div className="flex flex-col">
                                {/* 顶部标题 */}
                                <div className="flex items-center justify-between mt-3 mb-6">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="rounded-full p-2"
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="text-neutral-800 dark:text-neutral-200"
                                        >
                                            <path
                                                d="M19 12H5M5 12L12 19M5 12L12 5"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    </button>
                                    <h3 className="text-base font-medium">导入咖啡豆数据</h3>
                                    <div className="w-8"></div>
                                </div>

                                {/* 表单内容 */}
                                <div className="space-y-4 mt-2">
                                    {renderUploadSection()}
                                    <div className="flex items-center">
                                        <p className="text-xs text-neutral-500 dark:text-neutral-500 flex-1">
                                            {manualMode ? '粘贴JSON格式的咖啡豆数据：' : '粘贴JSON格式的咖啡豆数据：'}
                                        </p>
                                    </div>
                                    <textarea
                                        className="w-full h-40 p-3 border border-neutral-300 dark:border-neutral-700 rounded-md bg-transparent focus:border-neutral-800 dark:focus:border-neutral-400 focus:outline-none text-neutral-800 dark:text-neutral-200"
                                        placeholder={manualMode ? 
                                            '单个：{"name":"埃塞俄比亚耶加雪菲", "capacity":"200",...}\n多个：[{"name":"耶加雪菲",...},{"name":"瑰夏",...}]' : 
                                            '支持单个或多个咖啡豆数据，多个豆使用数组格式[{},{},...]'}
                                        value={importData}
                                        onChange={(e) => setImportData(e.target.value)}
                                    />
                                    {error && (
                                        <div className="text-sm text-red-500 dark:text-red-400">
                                            {error}
                                        </div>
                                    )}
                                    {success && (
                                        <div className="text-sm text-green-500 dark:text-green-400">
                                            {success}
                                        </div>
                                    )}
                                    <div className="flex justify-end space-x-3 my-4">
                                        <button
                                            onClick={handleClose}
                                            className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-md text-sm"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={handleImport}
                                            className="px-4 py-2 bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-800 rounded-md text-sm"
                                        >
                                            导入
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default ImportBeanModal 