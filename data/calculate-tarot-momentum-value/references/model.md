# Momentum–value model

## Single-card score

For an upright card:

\[
x=\operatorname{round}(0.80S+0.15D+0.05N)
\]

For a reversed card:

\[
x_R=\operatorname{round}(0.80S_R+0.15D_R+0.05N)
\]

The card number \(N\) does not change on reversal.

## Semantic value

| Score | Meaning |
|---:|---|
| +10 | completion, success, happiness, full realization |
| +8 | clear victory, control, abundance |
| +6 | growth, opportunity, effective support |
| +4 | modest progress, help, recovery |
| +2 | weak favorable tendency |
| 0 | neutral, suspended, undetermined |
| -2 | mild resistance, hesitation, imbalance |
| -4 | delay, conflict, restriction |
| -6 | loss, failure, strong obstruction |
| -8 | bondage, collapse, serious harm |
| -10 | destructive outcome or complete termination |

Intermediate integer values are allowed when the canonical meaning lies between anchors.

## Dynamic force

| Score | Image/action state |
|---:|---|
| +10 | charge, command, explicit advance |
| +8 | forceful action, creation, dominance |
| +6 | active exploration, communication, work |
| +4 | stable growth, gentle advance |
| +2 | preparation, observation, slight action |
| 0 | stillness, balance, waiting |
| -2 | retreat, closure, hesitation |
| -4 | trapped, stopped, losing control |
| -6 | conflict, falling, disintegration |
| -8 | forced destruction, catastrophe |
| -10 | complete cessation |

Intermediate integer values are allowed when needed.

## Rank score

For a Major Arcana number \(n=0,\ldots,21\):

\[
N_{\mathrm{major}}=\frac{20n}{21}-10
\]

For Minor Arcana rank \(r=1,\ldots,14\), use Ace \(=1\), Page \(=11\), Knight \(=12\), Queen \(=13\), King \(=14\):

\[
N_{\mathrm{minor}}=\frac{20(r-1)}{13}-10
\]

Do not add a separate suit bonus; suit influence belongs in meaning \(S\).

## Five-card momentum

\[
M=\frac{(x_2-x_1)+2(x_3-x_2)+3(x_4-x_3)+4(x_5-x_4)}{10}
\]

| Result | Label |
|---|---|
| \(M>1\) | moving |
| \(-1\le M\le1\) | not moving or unclear |
| \(M<-1\) | reverse momentum |

## Five-card value

\[
V=\frac{x_5+0.5x_4+0.25x_3+0.125x_2+0.0625x_1}{1.9375}
\]

| Result | Label |
|---|---|
| \(V>1\) | valuable |
| \(-1\le V\le1\) | unclear value |
| \(V<-1\) | negative value |

## Output order

Always show traditional meaning first, numeric components second, formulas third, and synthesis last. Clearly separate a symbolic reading from factual forecasting.
