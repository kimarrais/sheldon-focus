import React, { useEffect, useState } from 'react';

// Imported Vector Assets for Kim / Sheldon
import imgVector from '../../assets/figma/intro/vector.svg';
import imgVector1 from '../../assets/figma/intro/vector1.svg';
import imgVector2 from '../../assets/figma/intro/vector2.svg';
import imgVector3 from '../../assets/figma/intro/vector3.svg';
import imgVector4 from '../../assets/figma/intro/vector4.svg';
import imgVector5 from '../../assets/figma/intro/vector5.svg';
import imgVector6 from '../../assets/figma/intro/vector6.svg';
import imgSorrisoExpressaoInicial from '../../assets/figma/intro/sorriso-inicial.svg';
import imgVector7 from '../../assets/figma/intro/vector7.svg';
import imgVector8 from '../../assets/figma/intro/vector8.svg';
import imgVector9 from '../../assets/figma/intro/vector9.svg';
import imgVector10 from '../../assets/figma/intro/vector10.svg';
import imgVector11 from '../../assets/figma/intro/vector11.svg';
import imgVector12 from '../../assets/figma/intro/vector12.svg';
import imgVector13 from '../../assets/figma/intro/vector13.svg';
import imgVector14 from '../../assets/figma/intro/vector14.svg';
import imgVector15 from '../../assets/figma/intro/vector15.svg';
import imgVector16 from '../../assets/figma/intro/vector16.svg';
import imgOlhoExpressaoInicial from '../../assets/figma/intro/olho-inicial-1.svg';
import imgOlhoExpressaoInicial1 from '../../assets/figma/intro/olho-inicial-2.svg';
import imgOlhoExpressaoInicial2 from '../../assets/figma/intro/olho-inicial-3.svg';
import imgOlhoExpressaoInicial3 from '../../assets/figma/intro/olho-inicial-4.svg';
import imgVector17 from '../../assets/figma/intro/vector17.svg';
import imgVector18 from '../../assets/figma/intro/vector18.svg';
import imgVector19 from '../../assets/figma/intro/vector19.svg';
import imgVector20 from '../../assets/figma/intro/vector20.svg';
import imgVector21 from '../../assets/figma/intro/vector21.svg';
import imgBocaSorrisoFeliz from '../../assets/figma/intro/boca-feliz-1.svg';
import imgBocaSorrisoFeliz1 from '../../assets/figma/intro/boca-feliz-2.svg';
import imgBocaSorrisoFeliz2 from '../../assets/figma/intro/boca-feliz-3.svg';
import imgOlhoSorrisoFeliz from '../../assets/figma/intro/olho-feliz-1.svg';
import imgOlhoSorrisoFeliz1 from '../../assets/figma/intro/olho-feliz-2.svg';

interface AppIntroAnimationProps {
  onComplete: () => void;
}

export const AppIntroAnimation: React.FC<AppIntroAnimationProps> = ({
  onComplete,
}) => {
  const [scale, setScale] = useState<number>(1);
  const [isFinishing, setIsFinishing] = useState<boolean>(false);

  // Responsive scale to keep exact 1440x1024 proportion
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const scaleX = w / 1440;
      const scaleY = h / 1024;
      setScale(Math.min(scaleX, scaleY, 1.2));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Complete animation after sequence (6.2s, right as the 3 curtains finish unveiling)
  useEffect(() => {
    const finishTimer = setTimeout(() => {
      setIsFinishing(true);
    }, 6100);

    const endTimer = setTimeout(() => {
      onComplete();
    }, 6400);

    return () => {
      clearTimeout(finishTimer);
      clearTimeout(endTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 pointer-events-auto overflow-hidden flex items-center justify-center transition-opacity duration-500 ${
        isFinishing ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: 'transparent' }}
    >
      <style>{`
        @keyframes kimMotion {
          0%, 4.71% {
            transform: translate(-50%, -50%) translateY(0px) scale(1);
            opacity: 1;
          }
          13.82% {
            transform: translate(-50%, -50%) translateY(7px) scale(0.453);
            opacity: 1;
          }
          15.74% {
            transform: translate(-50%, -50%) translateY(-113px) scale(0.486, 0.423);
            opacity: 1;
          }
          18.82% {
            transform: translate(-50%, -50%) translateY(-62px) scale(0.431, 0.481);
            opacity: 1;
          }
          22.50% {
            transform: translate(-50%, -50%) translateY(-66.5px) scale(0.476, 0.432);
            opacity: 1;
          }
          25.88% {
            transform: translate(-50%, -50%) translateY(-66.5px) scale(0.453);
            opacity: 1;
          }
          73.24% {
            transform: translate(-50%, -50%) translateY(-66.5px) scale(0.453);
            opacity: 1;
          }
          76.03%, 100% {
            transform: translate(-50%, -50%) translateY(-90px) scale(0.43);
            opacity: 0;
          }
        }

        @keyframes initialFaceMotion {
          0%, 15.88% {
            transform: scaleY(1);
            opacity: 1;
          }
          17.94%, 100% {
            transform: scaleY(0.12);
            opacity: 0;
          }
        }

        @keyframes happyFaceMotion {
          0%, 16.18% {
            transform: scaleY(0.15);
            opacity: 0;
          }
          18.97%, 73.24% {
            transform: scaleY(1);
            opacity: 1;
          }
          76.03%, 100% {
            transform: scaleY(1);
            opacity: 0;
          }
        }

        @keyframes speechPopMotion {
          0%, 19.71% {
            transform: translateY(26px) scale(0.02);
            opacity: 0;
          }
          20.59% {
            opacity: 1;
          }
          23.09% {
            transform: translateY(-10px) scale(1.12, 0.88);
            opacity: 1;
          }
          25.59% {
            transform: translateY(0px) scale(0.97, 1.04);
            opacity: 1;
          }
          28.53%, 73.24% {
            transform: translateY(0px) scale(1, 1);
            opacity: 1;
          }
          76.03%, 100% {
            transform: translateY(-16px) scale(0.96);
            opacity: 0;
          }
        }

        @keyframes balloonExpandMotion {
          0%, 23.09% {
            transform: translateX(343.5px);
            width: 124px;
          }
          28.53%, 100% {
            transform: translateX(0px);
            width: 811px;
          }
        }

        @keyframes speechTextMotion {
          0%, 25.88% {
            transform: translateY(7px);
            opacity: 0;
          }
          29.71%, 73.24% {
            transform: translateY(0px);
            opacity: 1;
          }
          76.03%, 100% {
            transform: translateY(0px);
            opacity: 0;
          }
        }

        @keyframes curtainLeftMotion {
          0%, 74.71% {
            transform: scaleY(1);
          }
          84.56%, 100% {
            transform: scaleY(0);
          }
        }

        @keyframes curtainCenterMotion {
          0%, 76.76% {
            transform: scaleY(1);
          }
          86.62%, 100% {
            transform: scaleY(0);
          }
        }

        @keyframes curtainRightMotion {
          0%, 78.82% {
            transform: scaleY(1);
          }
          88.68%, 100% {
            transform: scaleY(0);
          }
        }

        .anim-kim {
          animation: kimMotion 6.8s cubic-bezier(0.42, 0, 0.58, 1) forwards;
          transform-origin: center center;
        }

        .anim-face-initial {
          animation: initialFaceMotion 6.8s cubic-bezier(0.42, 0, 0.58, 1) forwards;
          transform-origin: center center;
        }

        .anim-face-happy {
          animation: happyFaceMotion 6.8s cubic-bezier(0.42, 0, 0.58, 1) forwards;
          transform-origin: center center;
        }

        .anim-speech-pop {
          animation: speechPopMotion 6.8s cubic-bezier(0.42, 0, 0.58, 1) forwards;
          transform-origin: center center;
        }

        .anim-balloon-expand {
          animation: balloonExpandMotion 6.8s cubic-bezier(0.42, 0, 0.58, 1) forwards;
          transform-origin: left center;
        }

        .anim-speech-text {
          animation: speechTextMotion 6.8s cubic-bezier(0.42, 0, 0.58, 1) forwards;
        }

        .anim-curtain-left {
          animation: curtainLeftMotion 6.8s cubic-bezier(0.42, 0, 0.58, 1) forwards;
          transform-origin: top center;
        }

        .anim-curtain-center {
          animation: curtainCenterMotion 6.8s cubic-bezier(0.42, 0, 0.58, 1) forwards;
          transform-origin: top center;
        }

        .anim-curtain-right {
          animation: curtainRightMotion 6.8s cubic-bezier(0.42, 0, 0.58, 1) forwards;
          transform-origin: top center;
        }
      `}</style>

      {/* 3 Fullscreen Orange Curtains that reveal the app */}
      <div className="absolute inset-0 flex w-full h-full pointer-events-none z-10">
        <div className="w-1/3 h-full bg-[#FB7317] anim-curtain-left will-change-transform" />
        <div className="w-1/3 h-full bg-[#FB7317] anim-curtain-center will-change-transform" />
        <div className="w-1/3 h-full bg-[#FB7317] anim-curtain-right will-change-transform" />
      </div>

      {/* Scaled Animation Canvas matching Figma 1440x1024 */}
      <div
        className="relative w-[1440px] h-[1024px] pointer-events-none select-none shrink-0 z-20"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Kim Mascot Container with Jump Animation */}
        <div
          className="absolute bg-[#FB7213] h-[448px] left-1/2 top-1/2 w-[600px] overflow-hidden rounded-[40px] anim-kim will-change-transform shadow-2xl"
          data-node-id="58:166"
        >
          {/* Base Vector Layers */}
          <div className="absolute inset-[-33.93%_0_0_0]"><img alt="" className="w-full h-full block" src={imgVector} /></div>
          <div className="absolute inset-[-33.93%_0_23.52%_0]"><img alt="" className="w-full h-full block" src={imgVector1} /></div>
          <div className="absolute inset-[0.13%_64.4%_50.6%_6.85%]"><img alt="" className="w-full h-full block" src={imgVector2} /></div>
          <div className="absolute inset-[0.12%_6.6%_53.65%_64.95%]"><img alt="" className="w-full h-full block" src={imgVector3} /></div>
          <div className="absolute inset-[55.09%_14.1%_0_17.73%]"><img alt="" className="w-full h-full block" src={imgVector4} /></div>
          <div className="absolute inset-[79.29%_73.61%_8.8%_17.73%]"><img alt="" className="w-full h-full block" src={imgVector5} /></div>
          <div className="absolute inset-[78.2%_14.1%_11.86%_78.33%]"><img alt="" className="w-full h-full block" src={imgVector6} /></div>

          {/* Initial Face Expression (Sorriso + Olhos) */}
          <div className="absolute inset-[67.81%_38.09%_24.26%_41.86%] anim-face-initial">
            <img alt="" className="w-full h-full block" src={imgSorrisoExpressaoInicial} />
          </div>
          <div className="absolute inset-[44.22%_60.77%_33.99%_25.22%] anim-face-initial">
            <img alt="" className="w-full h-full block" src={imgOlhoExpressaoInicial} />
          </div>
          <div className="absolute inset-[47.47%_63.63%_46.85%_32.12%] anim-face-initial">
            <img alt="" className="w-full h-full block" src={imgOlhoExpressaoInicial1} />
          </div>
          <div className="absolute inset-[42.99%_22.16%_35.23%_63.96%] anim-face-initial">
            <img alt="" className="w-full h-full block" src={imgOlhoExpressaoInicial2} />
          </div>
          <div className="absolute inset-[46.08%_26.59%_48.25%_69.17%] anim-face-initial">
            <img alt="" className="w-full h-full block" src={imgOlhoExpressaoInicial3} />
          </div>

          {/* Details / Cheeks / Ears */}
          <div className="absolute inset-[60.05%_43.84%_32.03%_47.55%]"><img alt="" className="w-full h-full block" src={imgVector7} /></div>
          <div className="absolute inset-[61.16%_45.08%_36.94%_51.64%]"><img alt="" className="w-full h-full block" src={imgVector8} /></div>
          <div className="absolute inset-[15.18%_44.41%_61.16%_45.23%]"><img alt="" className="w-full h-full block" src={imgVector9} /></div>
          <div className="absolute inset-[58.35%_84.69%_28.33%_1.15%]"><img alt="" className="w-full h-full block" src={imgVector10} /></div>
          <div className="absolute inset-[16.63%_56.82%_66.48%_34.53%]"><img alt="" className="w-full h-full block" src={imgVector11} /></div>
          <div className="absolute inset-[16.11%_34.35%_66.67%_58.82%]"><img alt="" className="w-full h-full block" src={imgVector12} /></div>
          <div className="absolute inset-[55.34%_1.96%_34.63%_86.19%]"><img alt="" className="w-full h-full block" src={imgVector13} /></div>
          <div className="absolute inset-[42.26%_80.85%_46.91%_7.35%]"><img alt="" className="w-full h-full block" src={imgVector14} /></div>
          <div className="absolute inset-[38.58%_7.74%_52.19%_82.24%]"><img alt="" className="w-full h-full block" src={imgVector15} /></div>
          <div className="absolute inset-[73.74%_75.13%_15.96%_10.57%]"><img alt="" className="w-full h-full block" src={imgVector16} /></div>
          <div className="absolute inset-[11.56%_72.83%_60.02%_12.6%]"><img alt="" className="w-full h-full block" src={imgVector17} /></div>
          <div className="absolute inset-[11.46%_11.95%_61.7%_73.58%]"><img alt="" className="w-full h-full block" src={imgVector18} /></div>
          <div className="absolute inset-[67.28%_75.38%_27.09%_9.29%]"><img alt="" className="w-full h-full block" src={imgVector19} /></div>
          <div className="absolute inset-[72.29%_6.94%_19.56%_79.3%]"><img alt="" className="w-full h-full block" src={imgVector20} /></div>
          <div className="absolute inset-[65.26%_6.75%_30.79%_79.16%]"><img alt="" className="w-full h-full block" src={imgVector21} /></div>

          {/* Happy Smiling Face Expression (Boca + Olhos Sorriso) */}
          <div className="absolute inset-[67.26%_37.21%_13.01%_40.15%] anim-face-happy">
            <img alt="" className="w-full h-full block" src={imgBocaSorrisoFeliz} />
          </div>
          <div className="absolute inset-[74.78%_42.58%_13.01%_45.5%] anim-face-happy">
            <img alt="" className="w-full h-full block" src={imgBocaSorrisoFeliz1} />
          </div>
          <div className="absolute inset-[67.26%_37.21%_26.43%_40.15%] anim-face-happy">
            <img alt="" className="w-full h-full block" src={imgBocaSorrisoFeliz2} />
          </div>
          <div className="absolute inset-[47.3%_21.03%_39.98%_62.83%] anim-face-happy">
            <img alt="" className="w-full h-full block" src={imgOlhoSorrisoFeliz} />
          </div>
          <div className="absolute inset-[47.29%_59.89%_40.02%_23.97%] anim-face-happy">
            <img alt="" className="w-full h-full block" src={imgOlhoSorrisoFeliz1} />
          </div>
        </div>

        {/* Pop Speech Bubble: "Seu dia sempre melhor comigo, Kim" */}
        <div
          className="absolute h-[124px] left-[314px] top-[572px] w-[811px] anim-speech-pop will-change-transform"
          data-node-id="58:302"
        >
          {/* Expanding White Pill Balloon */}
          <div
            className="absolute bg-white h-[124px] left-0 rounded-[62px] top-0 shadow-2xl anim-balloon-expand will-change-transform"
            data-node-id="58:324"
          />

          {/* Speech Text */}
          <p
            className="absolute font-['Plus_Jakarta_Sans'] font-bold leading-normal left-0 right-0 text-center text-[#733002] text-[28px] sm:text-[32px] top-[38px] whitespace-nowrap anim-speech-text"
            data-node-id="58:333"
          >
            Seu dia sempre melhor comigo, Kim
          </p>
        </div>
      </div>
    </div>
  );
};

