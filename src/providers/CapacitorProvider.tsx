'use client';

import { useEffect } from 'react';
import { initCapacitor } from '@/lib/app/capacitor';
import initBrowserCompat from '@/lib/app/browserCompat';

export default function CapacitorInit() {
    useEffect(() => {
        // 在客户端组件挂载后初始化 Capacitor
        initCapacitor();
        
        // 初始化浏览器兼容性检测
        initBrowserCompat();
    }, []);

    // 这个组件不渲染任何内容
    return null;
} 