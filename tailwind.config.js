/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
  safelist: [
    'bg-green-600','bg-green-700','bg-green-50','bg-green-100',
    'bg-red-600','bg-red-700','bg-red-50','bg-red-100',
    'bg-yellow-50','bg-yellow-100','bg-blue-50','bg-blue-100',
    'bg-purple-50','text-green-600','text-green-700',
    'text-red-500','text-red-600','text-yellow-700',
    'text-blue-600','text-blue-700',
    'border-green-200','border-yellow-200','border-red-200',
  ],
}
