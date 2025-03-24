import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        
        // 发送请求到识别服务
        const response = await fetch('http://llm1.zrzz.site/upload', {
            method: 'POST',
            body: formData
        })

        // 检查响应是否成功
        if (!response.ok) {
            throw new Error('Recognition service request failed')
        }

        // 解析识别服务的响应
        const data = await response.json()

        // 返回识别结果
        return NextResponse.json({ 
            success: true,
            result: data.result
        })
    } catch (error) {
        console.error('Recognition error:', error)
        return NextResponse.json(
            { error: 'Recognition failed' },
            { status: 500 }
        )
    }
}