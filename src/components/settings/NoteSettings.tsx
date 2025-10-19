'use client'

import React from 'react'
import { ChevronLeft } from 'lucide-react'
import { SettingsOptions, defaultSettings } from './Settings'

interface NoteSettingsProps {
    settings: SettingsOptions
    onClose: () => void
    handleChange: <K extends keyof SettingsOptions>(key: K, value: SettingsOptions[K]) => void | Promise<void>
}

const NoteSettings: React.FC<NoteSettingsProps> = ({
    settings,
    onClose,
    handleChange
}) => {
    // 历史栈管理
    const onCloseRef = React.useRef(onClose)
    onCloseRef.current = onClose
    
    React.useEffect(() => {
        window.history.pushState({ modal: 'note-settings' }, '')
        
        const handlePopState = () => onCloseRef.current()
        window.addEventListener('popstate', handlePopState)
        
        return () => window.removeEventListener('popstate', handlePopState)
    }, [])

    // 关闭处理
    const handleClose = () => {
        if (window.history.state?.modal === 'note-settings') {
            window.history.back()
        } else {
            onClose()
        }
    }

    // 控制动画状态
    const [shouldRender, setShouldRender] = React.useState(false)
    const [isVisible, setIsVisible] = React.useState(false)

    // 处理显示/隐藏动画
    React.useEffect(() => {
        setShouldRender(true)
        const timer = setTimeout(() => setIsVisible(true), 10)
        return () => clearTimeout(timer)
    }, [])

    if (!shouldRender) return null

    // 获取当前设置，如果不存在则使用默认值
    const noteSettings = settings.noteSettings || defaultSettings.noteSettings!

    // 处理笔记设置变化
    const handleNoteSettingChange = (key: keyof typeof noteSettings, value: boolean) => {
        handleChange('noteSettings', {
            ...noteSettings,
            [key]: value
        })
    }

    return (
        <div
            className={`
                fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900 max-w-[500px] mx-auto
                transition-transform duration-[350ms] ease-[cubic-bezier(0.36,0.66,0.04,1)]
                ${isVisible ? 'translate-x-0' : 'translate-x-full'}
            `}
        >
            {/* 头部导航栏 */}
            <div className="relative flex items-center justify-center py-4 pt-safe-top">
                <button
                    onClick={handleClose}
                    className="absolute left-4 flex items-center justify-center w-10 h-10 rounded-full text-neutral-700 dark:text-neutral-300"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
                    笔记设置
                </h2>
            </div>

            {/* 滚动内容区域 */}
            <div className="relative flex-1 overflow-y-auto pb-safe-bottom divide-y divide-neutral-200 dark:divide-neutral-800">
                {/* 顶部渐变阴影 */}
                <div className="sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none first:border-b-0"></div>

                {/* 设置内容 */}
                <div className="px-6 py-4 -mt-4">
                    {/* 统一样式的设置项 */}
                    <div className="space-y-5">
                        {/* 默认展开风味评分 */}
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                                    默认展开风味评分
                                </div>
                                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                    添加笔记时默认展开风味评分面板
                                </div>
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center ml-4">
                                <input
                                    type="checkbox"
                                    checked={noteSettings.defaultExpandFlavorRatings}
                                    onChange={(e) =>
                                        handleNoteSettingChange('defaultExpandFlavorRatings', e.target.checked)
                                    }
                                    className="peer sr-only"
                                />
                                <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default NoteSettings
