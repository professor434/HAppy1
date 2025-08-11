import { Button } from "@/components/ui/button";

interface ClaimInfo {
  canClaim: boolean;
  total?: string;
}

interface Props {
  connected: boolean;
  isCheckingStatus: boolean;
  claimableTokens: ClaimInfo | null;
  presaleEnded: boolean;
  claimTokens: () => void;
  isClaimPending: boolean;
}

export default function ClaimSection({
  connected,
  isCheckingStatus,
  claimableTokens,
  presaleEnded,
  claimTokens,
  isClaimPending,
}: Props) {
  if (!connected) return null;

  return (
    <div className="bg-pink-500/20 p-4 rounded-md border border-pink-500">
      <h3 className="font-medium text-center mb-2">
        {isCheckingStatus ? "Checking claim status..." : "Token Claim"}
      </h3>
      {isCheckingStatus ? (
        <div className="flex justify-center py-2">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-pink-500"></div>
        </div>
      ) : claimableTokens === null ? (
        <p className="text-sm text-center">Unable to check claim status</p>
      ) : (
        <>
          {claimableTokens.total !== undefined && (
            <p className="text-sm text-center mb-3">
              You can claim {""}
              <span className="font-bold">
                {parseInt(claimableTokens.total, 10).toLocaleString()}
              </span>{" "}
              PENIS tokens
            </p>
          )}
          {presaleEnded && claimableTokens.canClaim ? (
            <>
              <Button
                onClick={claimTokens}
                disabled={isClaimPending}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              >
                {isClaimPending ? "Processing..." : "Claim Tokens"}
              </Button>
              <p className="text-xs text-center mt-2 text-gray-300">
                A small fee will be charged to process your claim
              </p>
            </>
          ) : (
            <p className="text-sm text-center">Claims open after the presale.</p>
          )}
        </>
      )}
    </div>
  );
}
