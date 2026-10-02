/**
 * Copyright (c) 2025, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useAsgardeo } from "@asgardeo/react";
import { environmentConfig } from "../util/environment-util";
import EditProfile from "../components/user-profile/edit-profile";
import ViewProfile from "../components/user-profile/view-profile";
import { SITE_SECTIONS } from "../constants/app-constants";
import IdentityVerificationStatus from "../components/identity-verification/identity-verification-status";
import { getExtendedProfile } from "../api/profile";
import { useContext } from "react";
import { IdentityVerificationContext } from "../context/identity-verification-provider";

const UserProfilePage = ({ setSiteSection }) => {
  const { isSignedIn, signIn, getDecodedIdToken, getAccessToken, http } = useAsgardeo();
  const { isIdentityVerificationEnabled, reloadIdentityVerificationStatus } = useContext(IdentityVerificationContext);

  const [userInfo, setUserInfo] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      signIn();
    }
  }, []);

  useEffect(() => {
    getUserInfo();
    //getIdToken();     // Update after the fix with refresh token
  }, []);

  const handleUpdateSuccess = () => {
    getUserInfo(); // Remove after the fix with refresh token
    reloadIdentityVerificationStatus();
    setShowEditForm(false);

    // updateToken().then(() => {    // Use after the fix with refresh token
    //   getUpdatedUser();
    //   setShowEditForm(false);
    // });
  };

  // Populate the profile straight from the ID token's claims instead of
  // calling /scim2/Me for most fields. Every sign-in method (password or
  // wallet) resolves to the same ID token, and for wallet logins there's
  // no backing local SCIM user to fetch - hitting /scim2/Me there 404s.
  // The token already carries everything we show here EXCEPT iban, which
  // isn't a token claim on this instance - it lives on the SCIM2 user
  // profile under a custom schema extension, so that one field still
  // needs its own /scim2/Me call (see getIban() below).
  const getUserInfo = () => {
    getDecodedIdToken().then((claims) => {
      if (!claims) {
        return;
      }
      setSiteSection(SITE_SECTIONS.PERSONAL);
      setUserInfo({
        userId: claims.sub || "",
        username: claims.given_name || claims.email || claims.sub || "",
        email: claims.email || "",
        givenName: claims.given_name || "",
        familyName: claims.family_name || "",
        picture: claims.picture || "",
        iban: "",
      });
      getIban();
    });
  };

  // IBAN comes back from /scim2/Me under
  // urn:scim:schemas:extension:custom:User.iban. This call 404s for
  // wallet-based sign-ins, because that flow has no backing local SCIM
  // user reachable via self-service - fall back to the BOA server's
  // /me-extended route, which resolves the real account via the caller's
  // verified email instead (see server/server.js).
  const getIban = (attemptsLeft = 3) => {
    http.request({
      method: "GET",
      headers: { "Accept": "application/json" },
      url: `${environmentConfig.ASGARDEO_BASE_URL}/scim2/Me`,
    }).then((response) => {
      const customSchema = response?.data?.["urn:scim:schemas:extension:custom:User"];
      console.log("[UserProfile] self-service /scim2/Me succeeded:", customSchema);
      if (customSchema && customSchema.iban) {
        setUserInfo((prev) => (prev ? { ...prev, iban: customSchema.iban } : prev));
      }
    }).catch(async (err) => {
      // Expected for wallet-based sign-ins - try the server-resolved
      // fallback instead of leaving IBAN blank.
      console.log(
        "[UserProfile] self-service /scim2/Me failed (expected for a wallet-based login), falling back to /me-extended:",
        err?.response?.status || err?.message || err
      );
      try {
        const token = await getAccessToken();
        const response = await getExtendedProfile(token);
        console.log("[UserProfile] /me-extended fallback succeeded:", response.data);
        if (response?.data?.iban) {
          setUserInfo((prev) => (prev ? { ...prev, iban: response.data.iban } : prev));
        }
      } catch (fallbackErr) {
        // Right after a fresh wallet-login redirect, getAccessToken() can
        // occasionally be called before the SDK has finished its token
        // exchange - retry a couple of times with a short backoff before
        // giving up and leaving IBAN blank.
        console.log(
          `[UserProfile] /me-extended fallback failed (attempts left after this: ${attemptsLeft - 1}):`,
          fallbackErr?.response?.data || fallbackErr?.message || fallbackErr
        );
        if (attemptsLeft > 1) {
          setTimeout(() => getIban(attemptsLeft - 1), 600);
        }
      }
    });
  };

  const handleCancelEdit = () => {
    setShowEditForm(false);
  };

  if (!userInfo) {
    return;
  }

  return (
    <>
      {isIdentityVerificationEnabled && <IdentityVerificationStatus />}
      <section className="about_section layout_padding">
        <div className="container-fluid">
          {showEditForm && userInfo ? (
            <>
              <EditProfile
                userInfo={userInfo}
                onUpdateSuccess={handleUpdateSuccess}
                onCancel={handleCancelEdit}
              />
            </>
          ) : (
            <ViewProfile
              userInfo={userInfo}
              setShowEditForm={setShowEditForm}
            />
         )}
        </div>
      </section>
    </>
  );
};

UserProfilePage.propTypes = {
  setSiteSection: PropTypes.object.isRequired,
};

export default UserProfilePage;
