export interface DeckSlide {
  n: number
  title: string
  mp4: string
  poster: string
}

export const DECK_SLIDES: DeckSlide[] = [
  { n: 1,  title: 'Problem',     mp4: '/pitchdeck/slides/01.mp4', poster: '/pitchdeck/slides/01.jpg' },
  { n: 2,  title: 'Market',      mp4: '/pitchdeck/slides/02.mp4', poster: '/pitchdeck/slides/02.jpg' },
  { n: 3,  title: 'Traction',    mp4: '/pitchdeck/slides/03.mp4', poster: '/pitchdeck/slides/03.jpg' },
  { n: 4,  title: 'Business',    mp4: '/pitchdeck/slides/04.mp4', poster: '/pitchdeck/slides/04.jpg' },
  { n: 5,  title: 'Competition', mp4: '/pitchdeck/slides/05.mp4', poster: '/pitchdeck/slides/05.jpg' },
  { n: 6,  title: 'Growth',      mp4: '/pitchdeck/slides/06.mp4', poster: '/pitchdeck/slides/06.jpg' },
  { n: 7,  title: 'Team',        mp4: '/pitchdeck/slides/07.mp4', poster: '/pitchdeck/slides/07.jpg' },
  { n: 8,  title: 'The Ask',     mp4: '/pitchdeck/slides/08.mp4', poster: '/pitchdeck/slides/08.jpg' },
  { n: 9,  title: 'Financials',  mp4: '/pitchdeck/slides/09.mp4', poster: '/pitchdeck/slides/09.jpg' },
  { n: 10, title: 'Risks',       mp4: '/pitchdeck/slides/10.mp4', poster: '/pitchdeck/slides/10.jpg' },
]

export const DECK_TOTAL = DECK_SLIDES.length
