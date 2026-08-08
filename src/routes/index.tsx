import { createFileRoute } from '@tanstack/react-router'
import { LandingPage } from '@/components/LandingPage'
import { Metadata } from '@/components/Metadata'

export const Route = createFileRoute('/')({
  head: () => ({
    title: 'Vejamais - Gestão Comercial e Financeira para o seu Negócio',
    meta: [
      {
        name: 'description',
        content: 'Controle financeiro completo, gestão de estoque, vendas e muito mais. O Vejamais é a solução ideal para pequenas e médias empresas que buscam eficiência e crescimento.',
      },
      {
        property: 'og:title',
        content: 'Vejamais - Gestão Comercial e Financeira',
      },
      {
        property: 'og:description',
        content: 'Sistema completo para gestão comercial e financeira de micro e pequenas empresas.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:url',
        content: 'https://vejamais.com.br',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'Vejamais - Gestão Comercial e Financeira',
      },
      {
        name: 'twitter:description',
        content: 'Sistema completo para gestão comercial e financeira de micro e pequenas empresas.',
      },
      {
        name: 'canonical',
        content: 'https://vejamais.com.br',
      },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          'name': 'Vejamais',
          'operatingSystem': 'Web',
          'applicationCategory': 'BusinessApplication',
          'offers': {
            '@type': 'Offer',
            'price': '0',
            'priceCurrency': 'BRL',
          },
        }),
      },
    ],
  }),
  component: LandingPage,
})
