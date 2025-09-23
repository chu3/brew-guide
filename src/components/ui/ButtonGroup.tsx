'use client'

import React from 'react'

interface ButtonGroupProps<T extends string> {
    value: T
    options: { value: T; label: string }[]
    onChange: (value: T) => void
    className?: string
}

export function ButtonGroup<T extends string>({ 
    value, 
    options, 
    onChange, 
    className = '' 
}: ButtonGroupProps<T>) {
    return (
        <div className={`inline-flex rounded bg-neutral-100/60 p-0.5 dark:bg-neutral-800/60 ${className}`}>
            {options.map((option) => (
                <button
                    key={option.value}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                        value === option.value
                            ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
                            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                    }`}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}