import React from "react";

const WaitingPopup = () => {
    return (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-[#00000056] flex items-center justify-center">
            <div className="absolute border-4 border-[#20d6d7] bg-[#0e6667] rounded-lg px-[20px] py-[30px] w-[500px] flex flex-col items-center justify-center">
                <div className="text-[20px] font-bold text-center">
                    Waiting for Opponent...
                </div>
                <div className="flex justify-center gap-20 w-full mt-[20px]">
                    <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-[#20d6d7]"></div>
                </div>
            </div>
        </div>
    );
};

export default WaitingPopup;