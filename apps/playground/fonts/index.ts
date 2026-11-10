import localFont from 'next/font/local'

const Montserrat = localFont({
	src: [
		{
			path: './Montserrat-VariableFont_wght.ttf',
			style: 'normal'
		},
		{
			path: './Montserrat-Italic-VariableFont_wght.ttf',
			style: 'italic'
		}
	],
	variable: '--font-montserrat',
	display: 'swap'
})

const JetbrainsMono = localFont({
	src: [
		{
			path: './JetBrainsMono-VariableFont_wght.ttf',
			style: 'normal'
		},
		{
			path: './JetBrainsMono-Italic-VariableFont_wght.ttf',
			style: 'italic'
		}
	],
	variable: '--font-jetbrains-mono',
	display: 'swap'
})
export {
	Montserrat,JetbrainsMono
}
