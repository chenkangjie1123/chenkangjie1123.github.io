# SLGaussian: Fast Language Gaussian Splatting in Sparse Views

> Builds 3D semantic fields from two RGB views without per-scene optimization and supports fast open-vocabulary 3D object querying and segmentation.

Venue: ACM Multimedia 2025. First posted to arXiv: 2024-12-11.

Authors: Kangjie Chen, BingQuan Dai, Minghan Qin, Dongbin Zhang, Peihao Li, Yingshuang Zou, Haoqian Wang.

## Abstract

3D semantic field learning is crucial for applications like autonomous navigation, AR/VR, and robotics, where accurate comprehension of 3D scenes from limited viewpoints is essential. Existing methods struggle under sparse view conditions, relying on inefficient per-scene multi-view optimizations, which are impractical for many real-world tasks. To address this, we propose SLGaussian, a feed-forward method for constructing 3D semantic fields from sparse viewpoints, allowing direct inference of 3DGS-based scenes. By ensuring consistent SAM segmentations through video tracking and using low-dimensional indexing for high-dimensional CLIP features, SLGaussian efficiently embeds language information in 3D space, offering a robust solution for accurate 3D scene understanding under sparse view conditions. In experiments on two-view sparse 3D object querying and segmentation in the LERF and 3D-OVS datasets, SLGaussian outperforms existing methods in chosen IoU, Localization Accuracy, and mIoU. Moreover, our model achieves scene inference in under 30 seconds and open-vocabulary querying in just 0.011 seconds per query.

## Sources

- [Project page](https://chenkangjie1123.github.io/SLGaussian/)
- [Paper on arXiv](https://arxiv.org/abs/2412.08331)
- [Source code](https://github.com/chenkangjie1123/SLGaussian)
