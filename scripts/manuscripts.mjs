// Five fictional sample manuscripts for the PeerOne demo.
// Authors, e-mail addresses (reserved .example domain), data and results are all invented.
// Institutions are real so the same-institution COI check fires against the real corpus.

export const MANUSCRIPTS = [
  {
    file: 'PeerOne_Sample_Manuscript_1_Chest_Xray_Triage.docx',
    label: 'Chest X-ray triage (strong topical overlap, Western Macedonia co-affiliation)',
    title: 'A Lightweight Convolutional Network for Pneumonia and COVID-19 Triage on Chest Radiographs',
    authors: [
      { name: 'Aisha Rahman', affiliation: 'University of Western Macedonia, Kozani, Greece', email: 'aisha.rahman@uowm-demo.example' },
      { name: 'Tomas Lindqvist', affiliation: 'Karolinska Institutet, Stockholm, Sweden', email: 'tomas.lindqvist@ki-demo.example' },
      { name: 'Priya Nair', affiliation: 'University of Melbourne, Melbourne, Australia', email: 'priya.nair@unimelb-demo.example' },
    ],
    abstract:
      'Rapid triage of chest radiographs is a bottleneck in emergency departments, particularly during respiratory-illness surges. We present a lightweight convolutional neural network that classifies frontal chest X-ray images as normal, bacterial pneumonia, viral pneumonia or COVID-19, designed to run on commodity hospital workstations without a GPU. The model combines depthwise-separable convolutions with transfer learning from a large public chest radiograph collection, and uses extensive data augmentation to cope with class imbalance. We evaluate on 24,600 radiographs drawn from four hospitals, with external validation at a fifth site. The network reaches an area under the ROC curve of 0.96 for pneumonia detection and 0.93 for COVID-19 identification while requiring under 60 ms per image. Gradient-weighted class activation maps show that predictions concentrate on clinically plausible lung regions. A reader study with six radiologists indicates that model assistance reduces median reporting time without reducing diagnostic accuracy. These results support lightweight deep learning as a practical decision-support tool for computer-aided diagnosis in resource-constrained settings.',
    keywords: ['chest radiography', 'pneumonia detection', 'convolutional neural networks', 'COVID-19 diagnosis', 'transfer learning', 'computer-aided diagnosis'],
    intro:
      'Chest radiography remains the first-line imaging test for suspected lower respiratory tract infection. During seasonal surges, the volume of examinations outpaces radiologist availability, delaying the identification of patients who need urgent care.',
  },
  {
    file: 'PeerOne_Sample_Manuscript_2_Glioma_Segmentation.docx',
    label: 'Glioma MRI segmentation (medium-strong overlap, no institutional conflicts)',
    title: 'Transformer-Based Segmentation of Glioma Subregions in Multi-Parametric Brain MRI',
    authors: [
      { name: 'Daniel Okafor', affiliation: 'University of Toronto, Toronto, Canada', email: 'daniel.okafor@utoronto-demo.example' },
      { name: 'Mei-Ling Chen', affiliation: 'National Taiwan University, Taipei, Taiwan', email: 'meiling.chen@ntu-demo.example' },
      { name: 'Sofia Marin', affiliation: 'Universitat Politecnica de Valencia, Valencia, Spain', email: 'sofia.marin@upv-demo.example' },
    ],
    abstract:
      'Accurate delineation of glioma subregions on multi-parametric MRI underpins surgical planning and treatment monitoring, yet manual segmentation is slow and varies between raters. We propose a hybrid architecture that couples a 3D convolutional encoder with a shifted-window transformer decoder to capture both local texture and long-range anatomical context across T1, T1-contrast, T2 and FLAIR sequences. A boundary-aware loss and test-time augmentation improve delineation of the enhancing tumour core, the region most affected by inter-rater disagreement. Trained on 1,250 multi-institutional brain tumour cases and evaluated on a held-out cohort of 219, the method achieves mean Dice scores of 0.91, 0.88 and 0.84 for whole tumour, tumour core and enhancing tumour, outperforming a strong U-Net baseline. We further show robustness to missing MRI sequences and to scanner variability. Our findings suggest that transformer-augmented segmentation networks can deliver reliable brain tumour segmentation for clinical radiology workflows.',
    keywords: ['brain tumor segmentation', 'glioma', 'vision transformer', 'U-Net', 'magnetic resonance imaging', 'medical image segmentation'],
    intro:
      'Gliomas are heterogeneous tumours whose subregions - necrotic core, enhancing tumour and peritumoural oedema - carry distinct prognostic and surgical significance. Reproducible volumetric measurement of these regions is therefore central to neuro-oncology.',
  },
  {
    file: 'PeerOne_Sample_Manuscript_3_Breast_Histopathology.docx',
    label: 'Breast histopathology, weak supervision (medium overlap, Northwest University co-affiliation)',
    title: 'Weakly Supervised Classification of Breast Cancer Whole-Slide Images with Attention-Based Multiple Instance Learning',
    authors: [
      { name: 'Elena Vasquez', affiliation: 'Northwest University, Xi\'an, China', email: 'elena.vasquez@nwu-demo.example' },
      { name: 'Jonas Weber', affiliation: 'Charite - Universitaetsmedizin Berlin, Berlin, Germany', email: 'jonas.weber@charite-demo.example' },
      { name: 'Hannah Osei', affiliation: 'University of Cape Town, Cape Town, South Africa', email: 'hannah.osei@uct-demo.example' },
    ],
    abstract:
      'Whole-slide histopathology images contain billions of pixels, and pixel-level annotation by pathologists is prohibitively expensive. We introduce an attention-based multiple instance learning framework that classifies breast cancer whole-slide images using only slide-level diagnostic labels. Each slide is divided into tiles that are embedded with a self-supervised histopathology encoder; a gated attention mechanism then aggregates tile embeddings into a slide representation and highlights diagnostically informative regions. Across 3,100 slides from three clinical sites, the approach distinguishes invasive carcinoma, ductal carcinoma in situ and benign tissue with an accuracy of 94.2% and generalizes to an external cohort with only a modest drop in performance. Attention heatmaps agree with pathologist annotations on a held-out subset, supporting interpretability. By removing the need for detailed annotations, weakly supervised learning can accelerate the development of histopathological image classification tools for early diagnosis of breast cancer.',
    keywords: ['histopathological image classification', 'whole-slide imaging', 'multiple instance learning', 'breast cancer', 'weakly supervised learning', 'computational pathology'],
    intro:
      'Digital pathology has made it possible to apply deep learning directly to scanned tissue sections. However, the dominant supervised paradigm depends on exhaustive regional annotations that few laboratories can afford to produce at scale.',
  },
  {
    file: 'PeerOne_Sample_Manuscript_4_Diabetic_Retinopathy.docx',
    label: 'Diabetic retinopathy, explainability (tangential overlap, no conflicts)',
    title: 'Calibrated and Explainable Deep Learning for Diabetic Retinopathy Grading from Fundus Photographs',
    authors: [
      { name: 'Karthik Subramanian', affiliation: 'Indian Institute of Technology Madras, Chennai, India', email: 'karthik.subramanian@iitm-demo.example' },
      { name: 'Fatima Zahra Idrissi', affiliation: 'Mohammed V University, Rabat, Morocco', email: 'fatima.idrissi@um5-demo.example' },
    ],
    abstract:
      'Automated screening for diabetic retinopathy can extend specialist-level grading to primary care, but clinicians are reluctant to rely on opaque models whose confidence scores are poorly calibrated. We develop a five-grade diabetic retinopathy classifier for retinal fundus photographs that jointly optimizes accuracy and probabilistic calibration, and pairs each prediction with a saliency explanation and an uncertainty estimate that flags images for human review. Using 88,000 fundus images from screening programmes in three countries, the calibrated model reduces expected calibration error from 0.087 to 0.021 relative to a standard ResNet baseline while maintaining a quadratic weighted kappa of 0.89. In a usability study, ophthalmologists rated explanation-augmented predictions as more trustworthy and were faster at confirming referable cases. We discuss implications for deploying explainable AI in clinical decision support for ophthalmic screening.',
    keywords: ['diabetic retinopathy', 'explainable AI', 'uncertainty estimation', 'model calibration', 'retinal fundus imaging', 'clinical decision support'],
    intro:
      'Diabetic retinopathy is a leading cause of preventable vision loss. Population screening programmes depend on trained graders, a scarce resource in many regions, which motivates automated grading support.',
  },
  {
    file: 'PeerOne_Sample_Manuscript_5_Federated_Lung_Nodules.docx',
    label: 'Federated learning on CT (tangential overlap, Mayo Clinic co-affiliation)',
    title: 'Federated Learning for Privacy-Preserving Lung Nodule Detection Across Hospitals',
    authors: [
      { name: 'Marcus Bell', affiliation: 'Mayo Clinic, Rochester, United States', email: 'marcus.bell@mayo-demo.example' },
      { name: 'Ingrid Solheim', affiliation: 'University of Oslo, Oslo, Norway', email: 'ingrid.solheim@uio-demo.example' },
      { name: 'Rajesh Iyer', affiliation: 'All India Institute of Medical Sciences, New Delhi, India', email: 'rajesh.iyer@aiims-demo.example' },
    ],
    abstract:
      'Training robust lung nodule detectors requires large, diverse computed tomography datasets, but patient privacy regulations prevent hospitals from pooling scans. We study federated learning as a way to train a shared three-dimensional nodule detection model across institutions without exchanging images. Seven hospitals collaboratively train a detection network using federated averaging with client-specific normalization layers to handle differences in scanner protocols and slice thickness. We compare against centralized training and single-site training on 9,800 CT scans. The federated model recovers 97% of the sensitivity of centralized training at one false positive per scan and substantially outperforms single-site models on out-of-distribution sites. Differential privacy noise provides formal guarantees with a modest accuracy cost, and a communication-efficient update scheme reduces bandwidth by 70%. Our results indicate that federated learning is a viable route to multi-institutional computed tomography models while respecting data governance constraints.',
    keywords: ['federated learning', 'lung nodule detection', 'computed tomography', 'privacy-preserving machine learning', 'deep learning', 'multi-institutional'],
    intro:
      'Early detection of pulmonary nodules on CT improves lung cancer outcomes, yet the data needed to train reliable detectors sit in separate institutional silos governed by differing privacy and data-sharing rules.',
  },
];

export const DISCLAIMER =
  'Sample manuscript generated for the PeerOne prototype demo. Authors, e-mail addresses, data and results are fictional.';
