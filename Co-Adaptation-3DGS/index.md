# Quantifying and Alleviating Co-Adaptation in Sparse-View 3D Gaussian Splatting

> Studies color artifacts caused by co-adapted Gaussians in sparse-view 3DGS, introduces a Co-Adaptation Score, and evaluates Gaussian dropout and opacity noise to improve novel-view rendering.

Venue: NeurIPS 2025. First posted to arXiv: 2025-08-18.

Authors: Kangjie Chen, Yingji Zhong, Zhihao Li, Jiaqi Lin, Youyu Chen, Minghan Qin, Haoqian Wang.

## Abstract

3D Gaussian Splatting (3DGS) has demonstrated impressive performance in novel view synthesis under dense-view settings. However, in sparse-view scenarios, despite the realistic renderings in training views, 3DGS occasionally manifests appearance artifacts in novel views. This paper investigates the appearance artifacts in sparse-view 3DGS and uncovers a core limitation of current approaches: the optimized Gaussians are overly-entangled with one another to aggressively fit the training views, which leads to a neglect of the real appearance distribution of the underlying scene and results in appearance artifacts in novel views. The analysis is based on a proposed metric, termed Co-Adaptation Score (CA), which quantifies the entanglement among Gaussians, i.e., co-adaptation, by computing the pixel-wise variance across multiple renderings of the same viewpoint, with different random subsets of Gaussians. The analysis reveals that the degree of co-adaptation is naturally alleviated as the number of training views increases. Based on the analysis, we propose two lightweight strategies to explicitly mitigate the co-adaptation in sparse-view 3DGS: (1) random gaussian dropout; (2) multiplicative noise injection to the opacity. Both strategies are designed to be plug-and-play, and their effectiveness is validated across various methods and benchmarks. We hope that our insights into the co-adaptation effect will inspire the community to achieve a more comprehensive understanding of sparse-view 3DGS.

## Sources

- [Project page](https://chenkangjie1123.github.io/Co-Adaptation-3DGS/)
- [Paper on arXiv](https://arxiv.org/abs/2508.12720)
- [Source code](https://github.com/chenkangjie1123/Co-Adaptation-of-3DGS/)
