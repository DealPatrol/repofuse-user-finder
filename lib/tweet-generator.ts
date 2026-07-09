import type { Prospect } from './prospect-engine/types'

export type TweetType = 'discovery' | 'education' | 'cta'

export interface GeneratedTweet {
  content: string
  type: TweetType
  prospectId?: string
  createdAt: Date
}

// Educational tweets - no prospect mentions, pure value
const educationalTweets = [
  "5 signs your GitHub projects are ready to monetize:\n1. You've built for yourself first\n2. Others are asking how to use it\n3. You've shipped v1\n4. You have a clear use case\n5. You've spent >20 hours on it\n\nTime to launch?",
  
  "Most developers don't realize 80% of their code is already worth $$$. They just haven't seen it as a product yet. What's hidden in your repos?",
  
  "The best products aren't built from scratch. They're extracted from problems you've already solved in code. Look at your repo history - there's gold there.",
  
  "Why do some devs turn side projects into $100k/year income while others stay stuck? They stopped thinking like developers and started thinking like builders.",
  
  "Your GitHub is a goldmine. Most developers have 2-3 half-built projects that could solve real problems. The missing piece isn't the code—it's seeing the opportunity.",
  
  "Shipping beats perfection. Every shipped project teaches you 10x more than polishing the perfect one. What's sitting in your repos unshipped?",
  
  "Found a pattern: Developers who make money from code don't write MORE code. They write BETTER summaries of what they built. Marketing > code.",
  
  "Your open source contributions are worth thousands. Companies are actively looking for builders. Have you considered that?",
  
  "90% of indie developers never reach $1k/month because they don't know where to look. The opportunities are everywhere—you just need to know the pattern.",
  
  "Building in public works. But most developers only share the highlight reel. Real traction comes from sharing the journey, mistakes included.",
]

// Discovery tweets - anonymized insights about prospects
function generateDiscoveryTweet(prospect: Prospect): string {
  const recentRepos = prospect.repos.slice(0, 3)
  const topicArea = recentRepos
    .flatMap((r) => r.matchedKeywords)
    .slice(0, 2)
    .join(' & ')

  const followerTier =
    prospect.followers > 1000
      ? 'established'
      : prospect.followers > 100
        ? 'growing'
        : 'emerging'

  const repoCount = prospect.repos.length

  const discoveries = [
    `Just found a ${followerTier} dev shipping ${repoCount} projects around ${topicArea}. They've got the skills, the output—question is: what's the next step?`,

    `Discovered someone with ${prospect.followers}+ followers building in ${topicArea}. Their last repo got love but no monetization. Sound familiar?`,

    `Spotted ${repoCount} repos from one dev in the ${topicArea} space. Each one useful, each one has potential. This is what hidden opportunity looks like.`,

    `A dev just shipped their ${Math.max(1, repoCount - 1)}th project around ${topicArea}. Pattern suggests they're close to something bigger.`,

    `Found someone who's clearly obsessed with ${topicArea}—${repoCount} repos prove it. The question: are they monetizing or just shipping for the love of it?`,
  ]

  return discoveries[Math.floor(Math.random() * discoveries.length)]
}

// CTA tweets - RepoFuse value prop
const ctaTweets = [
  "What if you could instantly scan 1000+ dev repos and see which ones are ready to become products? That's the RepoFuse model.",

  "Your GitHub tells your story. Have you looked at yours lately? Most devs have $X in unrealized potential sitting in their profile.",

  "The best ideas aren't new. They're already written in someone's code. Ever wonder what's out there?",

  "Building in public is great. But analyzing what's been built? That's where the real insight comes from.",

  "Stop scrolling through trending repos. Start analyzing repos that actually solve problems. There's a difference.",

  "Curious what opportunities are hiding in GitHub? Spoiler: a lot.",

  "Your next big break is probably already half-built. You just haven't seen it yet.",
]

export function generateTweet(type: TweetType, prospect?: Prospect): GeneratedTweet {
  let content = ''

  if (type === 'discovery' && prospect) {
    content = generateDiscoveryTweet(prospect)
  } else if (type === 'education') {
    content = educationalTweets[Math.floor(Math.random() * educationalTweets.length)]
  } else if (type === 'cta') {
    content = ctaTweets[Math.floor(Math.random() * ctaTweets.length)]
  }

  return {
    content,
    type,
    prospectId: prospect?.id,
    createdAt: new Date(),
  }
}

export function generateTweetBatch(count: number, prospects: Prospect[]): GeneratedTweet[] {
  const tweets: GeneratedTweet[] = []

  // Distribute types: 50% education, 30% discovery, 20% CTA
  const educationCount = Math.round(count * 0.5)
  const discoveryCount = Math.round(count * 0.3)
  const ctaCount = count - educationCount - discoveryCount

  // Generate education tweets
  for (let i = 0; i < educationCount; i++) {
    tweets.push(generateTweet('education'))
  }

  // Generate discovery tweets (use available prospects)
  for (let i = 0; i < discoveryCount; i++) {
    const prospect = prospects[Math.floor(Math.random() * prospects.length)]
    if (prospect) {
      tweets.push(generateTweet('discovery', prospect))
    } else {
      tweets.push(generateTweet('education'))
    }
  }

  // Generate CTA tweets
  for (let i = 0; i < ctaCount; i++) {
    tweets.push(generateTweet('cta'))
  }

  // Shuffle array to randomize order
  return tweets.sort(() => Math.random() - 0.5)
}
